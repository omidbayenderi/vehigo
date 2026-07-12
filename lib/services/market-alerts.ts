import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json, VehicleCondition, VehicleType } from "@/lib/supabase/types";
import { marketListingInputSchema, watchlistSchema } from "@/lib/validation/schemas";
import { partialUpdateFields } from "@/lib/utils";
import { sendTelegramMessage } from "@/lib/services/notifications";
import { assessOpportunity, opportunityReasonsToJson } from "@/lib/services/opportunity-agents";
import { assessEuropeanArbitrage, type ArbitrageAssessment } from "@/lib/services/arbitrage-agent";

type Client = SupabaseClient<Database>;
type Watchlist = Database["public"]["Tables"]["watchlists"]["Row"];
type Listing = Database["public"]["Tables"]["market_listings"]["Row"];
type Alert = Database["public"]["Tables"]["listing_alerts"]["Row"];
type UserProfile = Database["public"]["Tables"]["users_profile"]["Row"];
type MarketListingInsert = Database["public"]["Tables"]["market_listings"]["Insert"];
type WatchlistInsert = Database["public"]["Tables"]["watchlists"]["Insert"];
const SEAT_FILTER_PREFIX = "__vehigo_seat:";
const CONDITION_FILTER_PREFIX = "__vehigo_condition:";
const DETAIL_FILTER_PREFIX = "__vehigo_filter:";
const DETAIL_FILTER_KEYS = ["fuel_type", "transmission", "body_type", "drive_type", "seller_type", "min_power_hp", "max_power_hp", "min_engine_cc", "max_engine_cc", "min_doors", "max_doors", "emission_class", "exterior_color"] as const;
export type AlertWithListing = Alert & { market_listings: Listing | null; watchlists: Watchlist | null };
type PendingAlert = Alert & {
  market_listings: Listing | null;
  watchlists: Watchlist | null;
  users_profile: UserProfile | null;
};

export type MarketListingInput = {
  source_key: string;
  source_listing_id?: string;
  listing_url: string;
  title?: string;
  seller_name?: string;
  seller_country?: string;
  seller_city?: string;
  brand?: string;
  model?: string;
  year?: number;
  mileage_km?: number;
  price?: number;
  currency?: string;
  vehicle_type?: VehicleType;
  seat_count?: number;
  condition?: VehicleCondition;
  raw?: Record<string, unknown>;
};

export type ProcessListingsResult = {
  fetched: number;
  inserted: number;
  alertsCreated: number;
  alertsSent: number;
  alertsFailed: number;
};

export function calculateNextRunAt(
  from: Date,
  minIntervalMinutes: number,
  jitterPercent: number,
) {
  const jitter = Math.max(0, Math.min(jitterPercent, 100)) / 100;
  const spread = minIntervalMinutes * jitter;
  const offsetMinutes = minIntervalMinutes + (Math.random() * spread * 2 - spread);
  return new Date(from.getTime() + Math.max(1, offsetMinutes) * 60_000).toISOString();
}

export async function listMarketSources(supabase: Client) {
  const { data, error } = await supabase
    .from("market_sources")
    .select("*")
    .order("name", { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function listDueScannerSources(
  supabase: Client,
  options: { force?: boolean; sourceKey?: string; workerId?: string } = {},
) {
  const { data, error } = await supabase.rpc("claim_due_market_sources", {
    p_force: options.force ?? false,
    p_source_key: options.sourceKey ?? null,
    p_worker_id: options.workerId ?? crypto.randomUUID(),
    p_lease_minutes: 10,
  });
  if (error) {
    // Backward-compatible deploy: use the pre-lease query until migration 0014
    // has been applied to the production Supabase project.
    let fallback = supabase
      .from("market_sources")
      .select("*")
      .eq("enabled", true)
      .in("method", ["scrape", "web_search"]);
    if (options.sourceKey) fallback = fallback.eq("key", options.sourceKey);
    if (!options.force) fallback = fallback.or(`next_run_at.is.null,next_run_at.lte.${new Date().toISOString()}`);
    const { data: fallbackData, error: fallbackError } = await fallback;
    if (fallbackError) throw new Error(fallbackError.message);
    return fallbackData ?? [];
  }
  return data ?? [];
}

export const listDueScrapeSources = listDueScannerSources;

export async function listActiveWatchlistsForScanner(supabase: Client) {
  const { data, error } = await supabase
    .from("watchlists")
    .select("*")
    .eq("active", true)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function recordScannerRun(
  supabase: Client,
  sourceKey: string,
  startedAt: Date,
  outcome:
    | { status: "ok"; result: ProcessListingsResult }
    | { status: "failed"; error: string; fetchedCount?: number }
    | { status: "blocked" | "skipped"; error?: string },
) {
  const { data: source } = await supabase
    .from("market_sources")
    .select("*")
    .eq("key", sourceKey)
    .maybeSingle();

  const nextRunAt = source
    ? calculateNextRunAt(new Date(), source.min_interval_minutes, source.jitter_percent)
    : null;

  const runRow =
    outcome.status === "ok"
      ? {
          status: "ok" as const,
          fetched_count: outcome.result.fetched,
          new_count: outcome.result.inserted,
          alert_count: outcome.result.alertsCreated,
          error: null,
        }
      : {
          status: outcome.status,
          fetched_count: "fetchedCount" in outcome ? (outcome.fetchedCount ?? 0) : 0,
          new_count: 0,
          alert_count: 0,
          error: "error" in outcome ? (outcome.error ?? null) : null,
        };

  await supabase.from("scanner_runs").insert({
    source_key: sourceKey,
    started_at: startedAt.toISOString(),
    finished_at: new Date().toISOString(),
    next_run_at: nextRunAt,
    ...runRow,
  });

  if (source) {
    const baseUpdate = {
      last_run_at: startedAt.toISOString(),
      next_run_at: nextRunAt,
      last_status: runRow.status,
      last_error: runRow.error,
    };
    await supabase
      .from("market_sources")
      .update(baseUpdate)
      .eq("id", source.id);
    // Optional hardening columns are updated separately so a code deploy can
    // safely precede the production DB migration.
    await supabase
      .from("market_sources")
      .update({
        locked_until: null,
        locked_by: null,
        consecutive_failures: runRow.status === "ok" ? 0 : (source.consecutive_failures ?? 0) + 1,
        last_success_at: runRow.status === "ok" ? new Date().toISOString() : source.last_success_at,
      })
      .eq("id", source.id);
  }

  return { nextRunAt };
}

export async function listWatchlists(supabase: Client, userId: string) {
  const { data, error } = await supabase
    .from("watchlists")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function createWatchlist(
  supabase: Client,
  input: Record<string, unknown>,
  userId: string,
) {
  const parsed = watchlistSchema.parse(input);
  const { active: _active, seat_count, condition, ...watchlist } = parsed;
  void _active; // Editing criteria must preserve the separate pause/resume state.
  const detailMetadata = extractDetailMetadata(watchlist);
  const metadata = [
    seat_count ? `${SEAT_FILTER_PREFIX}${seat_count}` : null,
    condition ? `${CONDITION_FILTER_PREFIX}${condition}` : null,
    ...detailMetadata.tokens,
  ].filter((value): value is string => Boolean(value));
  const row: WatchlistInsert = {
    ...detailMetadata.watchlist,
    must_have_keywords: [...watchlist.must_have_keywords, ...metadata],
    user_id: userId,
  };
  const { data, error } = await supabase.from("watchlists").insert(row).select().single();
  if (error) throw new Error(error.message);
  return data;
}

export async function updateWatchlist(
  supabase: Client,
  id: string,
  input: Record<string, unknown>,
) {
  const parsed = partialUpdateFields(watchlistSchema, input);
  const update = Object.fromEntries(
    Object.entries(parsed).filter(([key]) => key !== "seat_count" && key !== "condition"),
  ) as Database["public"]["Tables"]["watchlists"]["Update"];
  const { data, error } = await supabase.from("watchlists").update(update).eq("id", id).select().single();
  if (error) throw new Error(error.message);
  return data;
}

export async function replaceWatchlist(
  supabase: Client,
  id: string,
  input: Record<string, unknown>,
) {
  const parsed = watchlistSchema.parse(input);
  const { seat_count, condition, ...watchlist } = parsed;
  const visibleMustHaves = watchlist.must_have_keywords.filter(
    (keyword) => !keyword.startsWith("__vehigo_"),
  );
  const detailMetadata = extractDetailMetadata(watchlist);
  const metadata = [
    seat_count ? `${SEAT_FILTER_PREFIX}${seat_count}` : null,
    condition ? `${CONDITION_FILTER_PREFIX}${condition}` : null,
  ].filter((value): value is string => Boolean(value));
  const nullableKeys = [
    "country", "city", "brand", "model", "vehicle_type", "min_year", "max_year",
    "max_mileage_km", "min_price", "max_price", "target_price",
  ] as const;
  metadata.push(...detailMetadata.tokens);
  const update: Database["public"]["Tables"]["watchlists"]["Update"] = {
    ...detailMetadata.watchlist,
    must_have_keywords: [...visibleMustHaves, ...metadata],
  };
  for (const key of nullableKeys) {
    if (!(key in input)) (update as Record<string, unknown>)[key] = null;
  }
  const { data, error } = await supabase.from("watchlists").update(update).eq("id", id).select().single();
  if (error) throw new Error(error.message);
  return data;
}

export async function deleteWatchlist(supabase: Client, id: string) {
  const { data, error } = await supabase.from("watchlists").delete().eq("id", id).select("id").single();
  if (error) throw new Error(error.message);
  return data;
}

/** Search the lightweight local index before waiting for the next remote scan. */
export async function matchStoredListingsForWatchlist(supabase: Client, watchlistId: string, limit = 1000) {
  const [{ data: watchlist, error: watchlistError }, { data: listings, error: listingsError }] = await Promise.all([
    supabase.from("watchlists").select("*").eq("id", watchlistId).single(),
    supabase
      .from("market_listings")
      .select("*")
      .eq("status", "active")
      .order("last_seen_at", { ascending: false })
      .limit(limit),
  ]);
  if (watchlistError) throw new Error(watchlistError.message);
  if (listingsError) throw new Error(listingsError.message);

  let created = 0;
  for (const listing of listings ?? []) {
    if (listingMatchesWatchlist(listing, watchlist) && await createAlertIfNeeded(supabase, listing, watchlist)) created++;
  }
  return created;
}

export async function listRecentAlerts(supabase: Client, userId: string, limit = 30) {
  const { data, error } = await supabase
    .from("listing_alerts")
    .select("*, market_listings(*), watchlists(*)")
    .eq("user_id", userId)
    .order("opportunity_score", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as AlertWithListing[];
}

export async function listShortlistedAlerts(supabase: Client, userId: string) {
  const { data, error } = await supabase
    .from("listing_alerts")
    .select("*, market_listings(*), watchlists(*)")
    .eq("user_id", userId)
    .eq("decision_status", "shortlisted")
    .order("decided_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as AlertWithListing[];
}

export async function processIncomingListings(
  supabase: Client,
  listings: MarketListingInput[],
): Promise<ProcessListingsResult> {
  const result: ProcessListingsResult = {
    fetched: listings.length,
    inserted: 0,
    alertsCreated: 0,
    alertsSent: 0,
    alertsFailed: 0,
  };

  const { data: watchlists, error: watchlistError } = await supabase
    .from("watchlists")
    .select("*")
    .eq("active", true);
  if (watchlistError) throw new Error(watchlistError.message);

  for (const input of listings) {
    const listing = await upsertMarketListing(supabase, input);
    if (listing.isNew) result.inserted++;

    const matchingWatchlists = (watchlists ?? []).filter((watchlist) =>
      listingMatchesWatchlist(listing.row, watchlist),
    );

    for (const watchlist of matchingWatchlists) {
      const created = await createAlertIfNeeded(supabase, listing.row, watchlist);
      if (created) result.alertsCreated++;
    }

    if (listing.priceDropped) {
      result.alertsCreated += await createPriceDropAlerts(supabase, listing.row);
    }
  }

  const delivery = await dispatchPendingTelegramAlerts(supabase);
  result.alertsSent = delivery.sent;
  result.alertsFailed = delivery.failed;

  return result;
}

export async function markStaleListingsAsDelisted(supabase: Client, staleDays = 3) {
  const cutoff = new Date(Date.now() - staleDays * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from("market_listings")
    .update({ status: "delisted", delisted_at: new Date().toISOString() })
    .eq("status", "active")
    .lt("last_seen_at", cutoff)
    .select("id");
  if (error) throw new Error(error.message);
  return data?.length ?? 0;
}

async function upsertMarketListing(supabase: Client, input: MarketListingInput) {
  const parsed = marketListingInputSchema.parse(input);
  const sourceListingId = parsed.source_listing_id ?? parsed.listing_url;
  const now = new Date().toISOString();

  const { data: existing, error: existingError } = await supabase
    .from("market_listings")
    .select("*")
    .eq("source_key", parsed.source_key)
    .eq("source_listing_id", sourceListingId)
    .maybeSingle();
  if (existingError) throw new Error(existingError.message);

  const priceDropped =
    existing !== null &&
    existing.price !== null &&
    parsed.price !== undefined &&
    parsed.price < existing.price;
  const priceChanged = existing !== null && parsed.price !== undefined && parsed.price !== existing.price;

  const row: MarketListingInsert = {
    source_key: parsed.source_key,
    source_listing_id: sourceListingId,
    listing_url: parsed.listing_url,
    title: parsed.title,
    seller_name: parsed.seller_name,
    seller_country: parsed.seller_country,
    seller_city: parsed.seller_city,
    brand: parsed.brand,
    model: parsed.model,
    year: parsed.year,
    mileage_km: parsed.mileage_km,
    price: parsed.price,
    currency: parsed.currency,
    vehicle_type: parsed.vehicle_type,
    raw: {
      ...(parsed.raw ?? {}),
      ...(parsed.seat_count ? { vehigo_seat_count: parsed.seat_count } : {}),
      ...(parsed.condition ? { vehigo_condition: parsed.condition } : {}),
    } as Json,
    last_seen_at: now,
    // Being fetched again means it's still live — undo any earlier stale/delisted sweep.
    status: "active",
    delisted_at: null,
  };

  if (existing) {
    const { data, error } = await supabase
      .from("market_listings")
      .update(row)
      .eq("id", existing.id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    if (priceChanged) await recordPriceHistory(supabase, data.id, data.price, data.currency);
    return { row: data, isNew: false, priceDropped };
  }

  const { data, error } = await supabase.from("market_listings").insert(row).select().single();
  if (error) throw new Error(error.message);
  await recordPriceHistory(supabase, data.id, data.price, data.currency);
  return { row: data, isNew: true, priceDropped: false };
}

async function recordPriceHistory(supabase: Client, listingId: string, price: number | null, currency: string) {
  const { error } = await supabase
    .from("market_listing_price_history")
    .insert({ listing_id: listingId, price, currency });
  if (error) throw new Error(error.message);
}

export function listingMatchesWatchlist(listing: Listing, watchlist: Watchlist) {
  const discoveredBySelectedWebSearch =
    watchlist.source_keys.includes("brave_web") && readRawString(listing.raw, "discovery_channel") === "brave_web";
  if (
    watchlist.source_keys.length > 0 &&
    !watchlist.source_keys.includes(listing.source_key) &&
    !discoveredBySelectedWebSearch
  ) return false;
  if (!textMatchesListing(watchlist.country, listing.seller_country, listing)) return false;
  if (!textMatchesListing(watchlist.city, listing.seller_city, listing)) return false;
  if (!textMatchesListing(watchlist.brand, listing.brand, listing, true)) return false;
  if (!textMatchesListing(watchlist.model, listing.model, listing, true)) return false;
  if (watchlist.vehicle_type && !vehicleTypeMatches(watchlist.vehicle_type, listing)) return false;
  const seatFilter = readSeatFilter(watchlist);
  const listingSeatCount = readRawNumber(listing.raw, "vehigo_seat_count");
  if (seatFilter !== null && listingSeatCount !== null && listingSeatCount !== seatFilter) return false;
  const conditionFilter = readConditionFilter(watchlist);
  const listingCondition = readRawCondition(listing.raw);
  if (conditionFilter !== null && listingCondition !== null && listingCondition !== conditionFilter) return false;
  if (watchlist.min_year !== null && (listing.year === null || listing.year < watchlist.min_year)) return false;
  if (watchlist.max_year !== null && (listing.year === null || listing.year > watchlist.max_year)) return false;
  if (watchlist.max_mileage_km !== null && listing.mileage_km !== null && listing.mileage_km > watchlist.max_mileage_km) return false;
  if (watchlist.min_price !== null && listing.price !== null && listing.price < watchlist.min_price) return false;
  if (watchlist.max_price !== null && listing.price !== null && listing.price > watchlist.max_price) return false;
  if (watchlist.keywords.length > 0) {
    const haystack = listingSearchText(listing);
    if (!watchlist.keywords.every((keyword) => haystack.includes(keyword.toLowerCase()))) return false;
  }
  const visibleMustHaves = watchlist.must_have_keywords.filter((keyword) => !keyword.startsWith("__vehigo_"));
  if (visibleMustHaves.length > 0) {
    const haystack = listingSearchText(listing);
    if (!visibleMustHaves.some((keyword) => haystack.includes(keyword.toLowerCase()))) return false;
  }
  if (!matchesDetailFilters(listing, watchlist)) return false;
  return true;
}

function extractDetailMetadata<T extends Record<string, unknown>>(watchlist: T) {
  const clean = { ...watchlist };
  const tokens: string[] = [];
  for (const key of DETAIL_FILTER_KEYS) {
    const value = clean[key];
    delete clean[key];
    if (value !== undefined && value !== null && value !== "") tokens.push(`${DETAIL_FILTER_PREFIX}${key}:${String(value)}`);
  }
  return { watchlist: clean as T, tokens };
}

function readDetailFilters(watchlist: Watchlist) {
  const result: Record<string, string> = {};
  for (const token of watchlist.must_have_keywords) {
    if (!token.startsWith(DETAIL_FILTER_PREFIX)) continue;
    const [key, ...rest] = token.slice(DETAIL_FILTER_PREFIX.length).split(":");
    if (key && rest.length) result[key] = rest.join(":");
  }
  return result;
}

function matchesDetailFilters(listing: Listing, watchlist: Watchlist) {
  const filters = readDetailFilters(watchlist);
  const text = listingSearchText(listing);
  const categorical: Record<string, Record<string, string[]>> = {
    fuel_type: { gasoline: ["gasoline", "petrol", "benzin"], diesel: ["diesel"], electric: ["electric", "elektro", "ev"], hybrid: ["hybrid", "phev"], lpg: ["lpg", "autogas"], hydrogen: ["hydrogen", "wasserstoff"], other: [] },
    transmission: { automatic: ["automatic", "automatik"], manual: ["manual", "schaltgetriebe", "handschaltung"], semi_automatic: ["semi-automatic", "halbautomatik"] },
    body_type: { sedan: ["sedan", "limousine"], suv: ["suv", "geländewagen"], station_wagon: ["station wagon", "kombi", "estate"], hatchback: ["hatchback"], coupe: ["coupe", "coupé"], convertible: ["convertible", "cabrio"], pickup: ["pickup", "pick-up"], van: ["van", "transporter"] },
    drive_type: { fwd: ["front wheel drive", "frontantrieb", "fwd"], rwd: ["rear wheel drive", "heckantrieb", "rwd"], awd: ["all wheel drive", "allrad", "4x4", "awd"] },
    seller_type: { private: ["private seller", "privatanbieter", "privat"], dealer: ["dealer", "händler", "gewerblich"] },
  };
  for (const [key, options] of Object.entries(categorical)) {
    const expected = filters[key];
    if (!expected) continue;
    const allKnownTerms = Object.values(options).flat();
    const detected = allKnownTerms.some((term) => text.includes(term));
    if (detected && !(options[expected] ?? []).some((term) => text.includes(term))) return false;
  }
  const power = firstNumber(text, /(\d{2,4})\s*(?:hp|ps|bhp|cv|pk)\b/i);
  const engineCc = inferEngineCc(text);
  const doors = firstNumber(text, /(\d)\s*(?:doors?|türen|tuerig)/i);
  if (!numberWithin(power, filters.min_power_hp, filters.max_power_hp)) return false;
  if (!numberWithin(engineCc, filters.min_engine_cc, filters.max_engine_cc)) return false;
  if (!numberWithin(doors, filters.min_doors, filters.max_doors)) return false;
  const expectedEmission = filters.emission_class?.toLowerCase();
  const detectedEmission = text.match(/\beuro\s*[1-6]\b/i)?.[0]?.toLowerCase();
  if (expectedEmission && detectedEmission && detectedEmission.replace(/\s+/g, "") !== expectedEmission.replace(/\s+/g, "")) return false;
  const expectedColor = filters.exterior_color?.toLowerCase();
  const knownColors = ["black", "white", "silver", "grey", "gray", "blue", "red", "green", "brown", "beige", "yellow", "orange", "purple", "siyah", "beyaz", "gri", "mavi", "kırmızı"];
  const detectedColor = knownColors.find((color) => text.includes(color));
  if (expectedColor && detectedColor && !text.includes(expectedColor)) return false;
  return true;
}

function firstNumber(text: string, pattern: RegExp) { const match = text.match(pattern); return match ? Number.parseInt(match[1], 10) : null; }
function inferEngineCc(text: string) {
  const cc = firstNumber(text, /(\d{3,5})\s*(?:cc|cm3|cm³)\b/i);
  if (cc) return cc;
  const liters = text.match(/\b(\d(?:[.,]\d))\s*(?:l|liter)\b/i);
  return liters ? Math.round(Number.parseFloat(liters[1].replace(",", ".")) * 1000) : null;
}
function numberWithin(value: number | null, min?: string, max?: string) {
  if (value === null) return true;
  if (min && value < Number(min)) return false;
  if (max && value > Number(max)) return false;
  return true;
}

function textMatchesListing(
  expected: string | null,
  actual: string | null,
  listing: Listing,
  allowTitleFallback = false,
) {
  if (!expected) return true;
  if (actual?.toLowerCase().includes(expected.toLowerCase())) return true;
  return (allowTitleFallback || isUnstructuredListing(listing)) &&
    listingSearchText(listing).includes(expected.toLowerCase());
}

function vehicleTypeMatches(expected: VehicleType, listing: Listing) {
  if (listing.vehicle_type === expected) return true;
  if (!isUnstructuredListing(listing)) return false;
  return inferVehicleType(listingSearchText(listing)) === expected;
}

function isUnstructuredListing(listing: Listing) {
  return listing.source_key === "brave_web" ||
    readRawString(listing.raw, "discovery_channel") === "brave_web" ||
    Boolean(readRawString(listing.raw, "source") === "email_alert");
}

function listingSearchText(listing: Listing) {
  return [
    listing.title,
    listing.brand,
    listing.model,
    listing.seller_city,
    listing.seller_country,
    readRawString(listing.raw, "description"),
    readRawString(listing.raw, "subject"),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function readRawString(raw: Json | null, key: string) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const value = raw[key as keyof typeof raw];
  return typeof value === "string" ? value : null;
}

function readRawNumber(raw: Json | null, key: string) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const value = raw[key as keyof typeof raw];
  return typeof value === "number" ? value : null;
}

function readRawCondition(raw: Json | null): VehicleCondition | null {
  const value = readRawString(raw, "vehigo_condition");
  return value && ["new", "used_excellent", "used_good", "used_fair", "damaged"].includes(value)
    ? value as VehicleCondition
    : null;
}

export function readListingSeatCount(listing: Listing) {
  return readRawNumber(listing.raw, "vehigo_seat_count");
}

export function readListingCondition(listing: Listing) {
  return readRawCondition(listing.raw);
}

export function readSeatFilter(watchlist: Watchlist) {
  const token = watchlist.must_have_keywords.find((keyword) => keyword.startsWith(SEAT_FILTER_PREFIX));
  if (!token) return null;
  const value = Number.parseInt(token.slice(SEAT_FILTER_PREFIX.length), 10);
  return Number.isFinite(value) ? value : null;
}

export function readConditionFilter(watchlist: Watchlist): VehicleCondition | null {
  const token = watchlist.must_have_keywords.find((keyword) => keyword.startsWith(CONDITION_FILTER_PREFIX));
  const value = token?.slice(CONDITION_FILTER_PREFIX.length);
  return value && ["new", "used_excellent", "used_good", "used_fair", "damaged"].includes(value)
    ? value as VehicleCondition
    : null;
}

function inferVehicleType(text: string): VehicleType | null {
  if (["trailer", "semi trailer", "auflieger", "remorque", "dorse"].some((term) => text.includes(term))) return "trailer";
  if (["excavator", "wheel loader", "construction machine", "baumaschine", "iş makinesi"].some((term) => text.includes(term))) return "construction";
  if (["spare parts", "truck parts", "ersatzteile", "yedek parça"].some((term) => text.includes(term))) return "spare_part";
  if (["bus", "coach", "reisebus", "otobüs"].some((term) => text.includes(term))) return "bus";
  if (["van", "transporter", "camionnette", "bestelwagen", "hafif ticari"].some((term) => text.includes(term))) return "van";
  if (["truck", "lorry", "vrachtwagen", "camion", "lastwagen", "tractor unit", "kamyon"].some((term) => text.includes(term))) return "truck";
  if (["car", "passenger car", "personenwagen", "voiture", "automobile", "otomobil"].some((term) => text.includes(term))) return "car";
  return null;
}

async function createAlertIfNeeded(supabase: Client, listing: Listing, watchlist: Watchlist) {
  const { data: existing, error: existingError } = await supabase
    .from("listing_alerts")
    .select("id")
    .eq("listing_id", listing.id)
    .eq("watchlist_id", watchlist.id)
    .eq("user_id", watchlist.user_id)
    .maybeSingle();
  if (existingError) throw new Error(existingError.message);
  if (existing) return false;
  const opportunity = assessOpportunity(listing, watchlist);

  const { error } = await supabase.from("listing_alerts").insert({
    listing_id: listing.id,
    watchlist_id: watchlist.id,
    user_id: watchlist.user_id,
    alert_type: "new_match",
    opportunity_score: opportunity.score,
    opportunity_label: opportunity.label,
    opportunity_reasons: opportunityReasonsToJson(opportunity.reasons),
  });
  if (error) throw new Error(error.message);
  return true;
}

/**
 * Re-notifies everyone who was already alerted about this exact listing (i.e. it
 * already matched their watchlist once) when its price drops. Relies on the unique
 * (listing_id, watchlist_id, user_id, alert_type) constraint to stay idempotent —
 * a second drop for the same listing/user won't insert a duplicate 'price_drop' row.
 */
async function createPriceDropAlerts(supabase: Client, listing: Listing) {
  const { data: priorAlerts, error } = await supabase
    .from("listing_alerts")
    .select("watchlist_id, user_id")
    .eq("listing_id", listing.id)
    .eq("alert_type", "new_match");
  if (error) throw new Error(error.message);
  if (!priorAlerts || priorAlerts.length === 0) return 0;

  let created = 0;
  for (const prior of priorAlerts) {
    const { data: existing, error: existingCheckError } = await supabase
      .from("listing_alerts")
      .select("id")
      .eq("listing_id", listing.id)
      .eq("watchlist_id", prior.watchlist_id)
      .eq("user_id", prior.user_id)
      .eq("alert_type", "price_drop")
      .maybeSingle();
    if (existingCheckError) throw new Error(existingCheckError.message);
    if (existing) {
      const { error: updateError } = await supabase
        .from("listing_alerts")
        .update({ status: "pending", sent_at: null, error: null, created_at: new Date().toISOString() })
        .eq("id", existing.id);
      if (updateError) throw new Error(updateError.message);
      created++;
      continue;
    }

    const { error: insertError } = await supabase.from("listing_alerts").insert({
      listing_id: listing.id,
      watchlist_id: prior.watchlist_id,
      user_id: prior.user_id,
      alert_type: "price_drop",
    });
    if (insertError) throw new Error(insertError.message);
    created++;
  }
  return created;
}

export async function dispatchPendingTelegramAlerts(supabase: Client, limit = 50) {
  const now = new Date().toISOString();
  let { data: alerts, error } = await supabase
    .from("listing_alerts")
    .select("*, market_listings(*), watchlists(*), users_profile(*)")
    .or(`status.eq.pending,and(status.eq.failed,next_attempt_at.lte.${now})`)
    .order("created_at", { ascending: true })
    .limit(limit * 4);
  if (error) {
    const fallback = await supabase
      .from("listing_alerts")
      .select("*, market_listings(*), watchlists(*), users_profile(*)")
      .eq("status", "pending")
      .order("created_at", { ascending: true })
      .limit(limit * 4);
    alerts = fallback.data;
    error = fallback.error;
  }
  if (error) throw new Error(error.message);

  let sent = 0;
  let failed = 0;

  for (const alert of (alerts ?? []) as unknown as PendingAlert[]) {
    if (sent + failed >= limit) break;
    const profile = alert.users_profile;
    const listing = alert.market_listings;
    const watchlist = alert.watchlists;

    if (!listing || !watchlist) continue;

    const previousPrice = alert.alert_type === "price_drop" ? await fetchPreviousPrice(supabase, listing.id) : null;
    const baseMessage = formatListingAlert(listing, watchlist, alert, previousPrice);
    const deliveries: Array<{ destination: string; message: string }> = [];
    const criteriaChannel = process.env.TELEGRAM_CRITERIA_CHANNEL ?? "@Vehigo_Kriter";
    const opportunityChannel = process.env.TELEGRAM_OPPORTUNITY_CHANNEL ?? "@Vehigo_Firsat";
    const arbitrageChannel = process.env.TELEGRAM_ARBITRAGE_CHANNEL ?? "@Vehigo_Arbitraj";
    if (criteriaChannel) deliveries.push({ destination: criteriaChannel, message: `<b>KRİTER EŞLEŞMESİ</b>\n${baseMessage}` });
    if ((alert.opportunity_score ?? 0) >= 65 && opportunityChannel) deliveries.push({ destination: opportunityChannel, message: `<b>FIRSAT SKORU: ${alert.opportunity_score}/100</b>\n${baseMessage}` });
    let arbitrage: ArbitrageAssessment | null = null;
    if (arbitrageChannel) {
      arbitrage = await assessEuropeanArbitrage(supabase, listing, watchlist);
      if (arbitrage.approved) deliveries.push({ destination: arbitrageChannel, message: formatArbitrageAlert(baseMessage, arbitrage) });
    }
    if (profile?.telegram_chat_id) deliveries.push({ destination: profile.telegram_chat_id, message: baseMessage });
    if (deliveries.length === 0) continue;
    const responses = await Promise.all(deliveries.map((delivery) => sendTelegramMessage(delivery.destination, delivery.message)));
    const failedDelivery = responses.find((response) => !response.ok);
    if (!failedDelivery) {
      await markAlert(supabase, alert, "sent", null);
      sent++;
    } else {
      await markAlert(supabase, alert, "failed", failedDelivery.error ?? "Telegram kanal gönderimi başarısız");
      failed++;
    }
  }

  return { sent, failed };
}

function formatArbitrageAlert(baseMessage: string, assessment: ArbitrageAssessment) {
  const margin = assessment.estimatedNetProfitPercent?.toFixed(1) ?? "?";
  const median = assessment.medianComparablePrice?.toLocaleString("tr-TR") ?? "?";
  return [
    `<b>AI AVRUPA ARBİTRAJ FIRSATI</b>`,
    `<b>Tahmini net kâr:</b> %${margin}`,
    `<b>Medyan karşılaştırma:</b> ${median} EUR (${assessment.comparableCount} ilan)`,
    `<b>AI güveni:</b> %${Math.round(assessment.confidence * 100)}`,
    `<b>Değerlendirme:</b> ${escapeHtml(assessment.reason)}`,
    "",
    baseMessage,
  ].join("\n");
}

async function markAlert(
  supabase: Client,
  alert: PendingAlert,
  status: "sent" | "failed",
  error: string | null,
) {
  const attempts = (alert.delivery_attempts ?? 0) + 1;
  const retryMinutes = Math.min(360, 5 * 2 ** Math.min(attempts - 1, 6));
  const { error: retryUpdateError } = await supabase
    .from("listing_alerts")
    .update({
      status,
      error,
      sent_at: status === "sent" ? new Date().toISOString() : null,
      delivery_attempts: attempts,
      next_attempt_at: status === "failed" ? new Date(Date.now() + retryMinutes * 60_000).toISOString() : null,
    })
    .eq("id", alert.id);
  if (retryUpdateError) {
    await supabase
      .from("listing_alerts")
      .update({
        status,
        error,
        sent_at: status === "sent" ? new Date().toISOString() : null,
      })
      .eq("id", alert.id);
  }
}

async function fetchPreviousPrice(supabase: Client, listingId: string) {
  const { data, error } = await supabase
    .from("market_listing_price_history")
    .select("price")
    .eq("listing_id", listingId)
    .order("recorded_at", { ascending: false })
    .range(1, 1);
  if (error) throw new Error(error.message);
  return data?.[0]?.price ?? null;
}

function formatListingAlert(
  listing: Listing,
  watchlist: Watchlist,
  alert: PendingAlert,
  previousPrice: number | null,
) {
  const title = listing.title || [listing.brand, listing.model, listing.year].filter(Boolean).join(" ");
  const price = listing.price === null ? "-" : `${listing.price.toLocaleString("tr-TR")} ${listing.currency}`;
  const mileage = listing.mileage_km === null ? "-" : `${listing.mileage_km.toLocaleString("tr-TR")} km`;
  const location = [listing.seller_city, listing.seller_country].filter(Boolean).join(", ") || "-";
  const reasons = Array.isArray(alert.opportunity_reasons) ? alert.opportunity_reasons : [];

  if (alert.alert_type === "price_drop") {
    const previous = previousPrice === null ? null : `${previousPrice.toLocaleString("tr-TR")} ${listing.currency}`;
    return [
      `[FİYAT DÜŞTÜ] ${escapeHtml(watchlist.name)}`,
      ``,
      `<b>${escapeHtml(title || "Araç ilanı")}</b>`,
      previous ? `Eski fiyat: <s>${escapeHtml(previous)}</s>` : null,
      `Yeni fiyat: <b>${escapeHtml(price)}</b>`,
      `Konum: ${escapeHtml(location)}`,
      ``,
      `<a href="${escapeHtml(listing.listing_url)}">İlanı aç</a>`,
    ]
      .filter(Boolean)
      .join("\n");
  }

  return [
    `[${labelText(alert.opportunity_label)}] Yeni fırsat alarmı: ${escapeHtml(watchlist.name)}`,
    alert.opportunity_score !== null ? `Fırsat skoru: <b>${alert.opportunity_score}/100</b> (${escapeHtml(alert.opportunity_label ?? "watch")})` : null,
    ``,
    `<b>${escapeHtml(title || "Araç ilanı")}</b>`,
    `Kaynak: ${escapeHtml(listing.source_key)}`,
    `Konum: ${escapeHtml(location)}`,
    `Fiyat: ${escapeHtml(price)}`,
    `Km: ${escapeHtml(mileage)}`,
    listing.year ? `Yıl: ${listing.year}` : null,
    reasons.length > 0 ? `` : null,
    ...reasons.slice(0, 4).map((reason) => `• ${escapeHtml(String(reason))}`),
    ``,
    `<a href="${escapeHtml(listing.listing_url)}">İlanı aç</a>`,
  ]
    .filter(Boolean)
    .join("\n");
}

function labelText(label: PendingAlert["opportunity_label"]) {
  if (label === "hot") return "HOT";
  if (label === "good") return "GOOD";
  if (label === "watch") return "WATCH";
  return "INFO";
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

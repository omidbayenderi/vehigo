import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json, VehicleType } from "@/lib/supabase/types";
import { marketListingInputSchema, watchlistSchema } from "@/lib/validation/schemas";
import { partialUpdateFields } from "@/lib/utils";
import { sendTelegramMessage } from "@/lib/services/notifications";
import { assessOpportunity, opportunityReasonsToJson } from "@/lib/services/opportunity-agents";

type Client = SupabaseClient<Database>;
type Watchlist = Database["public"]["Tables"]["watchlists"]["Row"];
type Listing = Database["public"]["Tables"]["market_listings"]["Row"];
type Alert = Database["public"]["Tables"]["listing_alerts"]["Row"];
type UserProfile = Database["public"]["Tables"]["users_profile"]["Row"];
type MarketListingInsert = Database["public"]["Tables"]["market_listings"]["Insert"];
type WatchlistInsert = Database["public"]["Tables"]["watchlists"]["Insert"];
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

export async function listDueScannerSources(supabase: Client, options: { force?: boolean } = {}) {
  const nowIso = new Date().toISOString();
  let query = supabase
    .from("market_sources")
    .select("*")
    .eq("enabled", true)
    .in("method", ["scrape", "web_search"]);

  if (!options.force) {
    query = query.or(`next_run_at.is.null,next_run_at.lte.${nowIso}`);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
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
    await supabase
      .from("market_sources")
      .update({
        last_run_at: startedAt.toISOString(),
        next_run_at: nextRunAt,
        last_status: runRow.status,
        last_error: runRow.error,
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
  const row: WatchlistInsert = { ...parsed, user_id: userId };
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
  const { data, error } = await supabase.from("watchlists").update(parsed).eq("id", id).select().single();
  if (error) throw new Error(error.message);
  return data;
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
  }

  const dispatchResult = await dispatchPendingTelegramAlerts(supabase);
  result.alertsSent = dispatchResult.sent;
  result.alertsFailed = dispatchResult.failed;

  return result;
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
    raw: (parsed.raw ?? null) as Json,
    last_seen_at: now,
  };

  if (existing) {
    const { data, error } = await supabase
      .from("market_listings")
      .update(row)
      .eq("id", existing.id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return { row: data, isNew: false };
  }

  const { data, error } = await supabase.from("market_listings").insert(row).select().single();
  if (error) throw new Error(error.message);
  return { row: data, isNew: true };
}

function listingMatchesWatchlist(listing: Listing, watchlist: Watchlist) {
  if (watchlist.source_keys.length > 0 && !watchlist.source_keys.includes(listing.source_key)) return false;
  if (!textMatchesListing(watchlist.country, listing.seller_country, listing)) return false;
  if (!textMatchesListing(watchlist.city, listing.seller_city, listing)) return false;
  if (!textMatchesListing(watchlist.brand, listing.brand, listing)) return false;
  if (!textMatchesListing(watchlist.model, listing.model, listing)) return false;
  if (watchlist.vehicle_type && !vehicleTypeMatches(watchlist.vehicle_type, listing)) return false;
  if (watchlist.min_year !== null && (listing.year === null || listing.year < watchlist.min_year)) return false;
  if (watchlist.max_year !== null && (listing.year === null || listing.year > watchlist.max_year)) return false;
  if (watchlist.max_mileage_km !== null && listing.mileage_km !== null && listing.mileage_km > watchlist.max_mileage_km) return false;
  if (watchlist.min_price !== null && listing.price !== null && listing.price < watchlist.min_price) return false;
  if (watchlist.max_price !== null && listing.price !== null && listing.price > watchlist.max_price) return false;
  if (watchlist.keywords.length > 0) {
    const haystack = listingSearchText(listing);
    if (!watchlist.keywords.every((keyword) => haystack.includes(keyword.toLowerCase()))) return false;
  }
  return true;
}

function textMatchesListing(expected: string | null, actual: string | null, listing: Listing) {
  if (!expected) return true;
  if (actual?.toLowerCase().includes(expected.toLowerCase())) return true;
  return isUnstructuredListing(listing) && listingSearchText(listing).includes(expected.toLowerCase());
}

function vehicleTypeMatches(expected: VehicleType, listing: Listing) {
  if (listing.vehicle_type === expected) return true;
  if (!isUnstructuredListing(listing)) return false;
  return inferVehicleType(listingSearchText(listing)) === expected;
}

function isUnstructuredListing(listing: Listing) {
  return listing.source_key === "brave_web" || Boolean(readRawString(listing.raw, "source") === "email_alert");
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

function inferVehicleType(text: string): VehicleType | null {
  if (["trailer", "semi trailer", "auflieger", "remorque", "dorse"].some((term) => text.includes(term))) return "trailer";
  if (["excavator", "wheel loader", "construction machine", "baumaschine", "iş makinesi"].some((term) => text.includes(term))) return "construction";
  if (["spare parts", "truck parts", "ersatzteile", "yedek parça"].some((term) => text.includes(term))) return "spare_part";
  if (["bus", "coach", "reisebus", "otobüs"].some((term) => text.includes(term))) return "bus";
  if (["truck", "lorry", "vrachtwagen", "camion", "lastwagen", "tractor unit", "kamyon"].some((term) => text.includes(term))) return "truck";
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
    opportunity_score: opportunity.score,
    opportunity_label: opportunity.label,
    opportunity_reasons: opportunityReasonsToJson(opportunity.reasons),
  });
  if (error) throw new Error(error.message);
  return true;
}

export async function dispatchPendingTelegramAlerts(supabase: Client, limit = 50) {
  const { data: alerts, error } = await supabase
    .from("listing_alerts")
    .select("*, market_listings(*), watchlists(*), users_profile(*)")
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(limit);
  if (error) throw new Error(error.message);

  let sent = 0;
  let failed = 0;

  for (const alert of (alerts ?? []) as unknown as PendingAlert[]) {
    const profile = alert.users_profile;
    const listing = alert.market_listings;
    const watchlist = alert.watchlists;

    if (!profile?.telegram_chat_id || !listing || !watchlist) {
      await markAlert(supabase, alert.id, "failed", "Telegram chat_id doğrulanmamış");
      failed++;
      continue;
    }

    const response = await sendTelegramMessage(profile.telegram_chat_id, formatListingAlert(listing, watchlist, alert));
    if (response.ok) {
      await markAlert(supabase, alert.id, "sent", null);
      sent++;
    } else {
      await markAlert(supabase, alert.id, "failed", response.error ?? "Telegram gönderimi başarısız");
      failed++;
    }
  }

  return { sent, failed };
}

async function markAlert(
  supabase: Client,
  id: string,
  status: "sent" | "failed",
  error: string | null,
) {
  await supabase
    .from("listing_alerts")
    .update({
      status,
      error,
      sent_at: status === "sent" ? new Date().toISOString() : null,
    })
    .eq("id", id);
}

function formatListingAlert(listing: Listing, watchlist: Watchlist, alert: PendingAlert) {
  const title = listing.title || [listing.brand, listing.model, listing.year].filter(Boolean).join(" ");
  const price = listing.price === null ? "-" : `${listing.price.toLocaleString("tr-TR")} ${listing.currency}`;
  const mileage = listing.mileage_km === null ? "-" : `${listing.mileage_km.toLocaleString("tr-TR")} km`;
  const location = [listing.seller_city, listing.seller_country].filter(Boolean).join(", ") || "-";
  const reasons = Array.isArray(alert.opportunity_reasons) ? alert.opportunity_reasons : [];

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

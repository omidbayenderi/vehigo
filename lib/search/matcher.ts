import type { Database, Json } from "@/lib/supabase/types";
import { canonicalCountryCode } from "@/lib/normalization/normalize-listing";
import { distanceKm, resolveCountryCodes } from "./geography";

export type SearchListing = Database["public"]["Tables"]["market_listings"]["Row"];
export type SearchWatchlist = Database["public"]["Tables"]["watchlists"]["Row"];

export type ListingMatchEvaluation = {
  matches: boolean;
  mode: "strict" | "discovery";
  score: number;
  reasons: string[];
  unknownFields: string[];
  rejectedBy: string | null;
  distanceKm: number | null;
};

type EvaluationState = {
  mode: "strict" | "discovery";
  reasons: string[];
  unknownFields: string[];
  rejectedBy: string | null;
  distanceKm: number | null;
};

export function evaluateListingForWatchlist(
  listing: SearchListing,
  watchlist: SearchWatchlist,
  now: Date = new Date(),
): ListingMatchEvaluation {
  const state: EvaluationState = {
    mode: watchlist.search_mode ?? "discovery",
    reasons: [],
    unknownFields: [],
    rejectedBy: null,
    distanceKm: null,
  };

  if (!matchesSource(listing, watchlist)) reject(state, "source");

  const countryCodes = resolveCountryCodes(watchlist);
  const listingCountryCode = listing.seller_country_code ?? canonicalCountryCode(listing.seller_country) ?? null;
  knownFilter(state, "country", countryCodes.length > 0, listingCountryCode, (value) => countryCodes.includes(value), true);
  textFilter(state, "city", watchlist.city, listing.seller_city, listing);
  textFilter(state, "brand", watchlist.brand, listing.brand, listing, true, true);
  textFilter(state, "model", watchlist.model, listing.model, listing, true, true);
  knownFilter(state, "vehicle_type", Boolean(watchlist.vehicle_type), listing.vehicle_type, (value) => value === watchlist.vehicle_type, true);

  numberRange(state, "year", listing.year, watchlist.min_year, watchlist.max_year);
  numberRange(state, "mileage_km", listing.mileage_km, null, watchlist.max_mileage_km);
  const hasPriceFilter = watchlist.min_price != null || watchlist.max_price != null || watchlist.target_price != null;
  if (hasPriceFilter && listing.price != null && watchlist.currency && listing.currency !== watchlist.currency) {
    reject(state, "currency");
  }
  numberRange(state, "price", listing.price, watchlist.min_price, watchlist.max_price);
  numberRange(state, "power_hp", listing.power_hp ?? inferNumber(listing, /(\d{2,4})\s*(?:hp|ps|bhp|cv|pk)\b/i), numericWatchlistValue(watchlist, "min_power_hp"), numericWatchlistValue(watchlist, "max_power_hp"));
  numberRange(state, "engine_cc", listing.engine_cc ?? inferEngineCc(listing), numericWatchlistValue(watchlist, "min_engine_cc"), numericWatchlistValue(watchlist, "max_engine_cc"));
  numberRange(state, "door_count", listing.door_count ?? inferNumber(listing, /(\d)\s*(?:doors?|türen|tuerig)/i), numericWatchlistValue(watchlist, "min_doors"), numericWatchlistValue(watchlist, "max_doors"));

  const seatCount = listing.seat_count ?? readRawNumber(listing.raw, "vehigo_seat_count");
  const expectedSeatCount = numericWatchlistValue(watchlist, "seat_count");
  const expectedCondition = stringWatchlistValue(watchlist, "condition");
  knownFilter(state, "seat_count", expectedSeatCount != null, seatCount, (value) => value === expectedSeatCount);
  knownFilter(state, "condition", Boolean(expectedCondition), listing.condition ?? readRawString(listing.raw, "vehigo_condition"), (value) => value === expectedCondition);
  categoricalFilter(state, "fuel_type", stringWatchlistValue(watchlist, "fuel_type"), listing.fuel_type, listing, {
    gasoline: ["gasoline", "petrol", "benzin"], diesel: ["diesel"], electric: ["electric", "elektro", "ev"],
    hybrid: ["hybrid", "phev"], lpg: ["lpg", "autogas"], hydrogen: ["hydrogen", "wasserstoff"],
  });
  categoricalFilter(state, "transmission", stringWatchlistValue(watchlist, "transmission"), listing.transmission, listing, {
    automatic: ["automatic", "automatik"], manual: ["manual", "schaltgetriebe", "handschaltung"], semi_automatic: ["semi-automatic", "halbautomatik"],
  });
  categoricalFilter(state, "body_type", stringWatchlistValue(watchlist, "body_type"), listing.body_type, listing, {
    sedan: ["sedan", "limousine"], suv: ["suv", "geländewagen"], station_wagon: ["station wagon", "kombi", "estate"],
    hatchback: ["hatchback"], coupe: ["coupe", "coupé"], convertible: ["convertible", "cabrio"], pickup: ["pickup", "pick-up"], van: ["van", "transporter"],
  });
  categoricalFilter(state, "drive_type", stringWatchlistValue(watchlist, "drive_type"), listing.drive_type, listing, {
    fwd: ["front wheel drive", "frontantrieb", "fwd"], rwd: ["rear wheel drive", "heckantrieb", "rwd"], awd: ["all wheel drive", "allrad", "4x4", "awd"],
  });
  categoricalFilter(state, "seller_type", stringWatchlistValue(watchlist, "seller_type"), listing.seller_type, listing, {
    private: ["private seller", "privatanbieter", "privat"], dealer: ["dealer", "händler", "gewerblich"],
  });
  textFilter(state, "emission_class", stringWatchlistValue(watchlist, "emission_class"), listing.emission_class, listing);
  textFilter(state, "exterior_color", stringWatchlistValue(watchlist, "exterior_color"), listing.exterior_color, listing);

  const centerLatitude = watchlist.center_latitude;
  const centerLongitude = watchlist.center_longitude;
  const radiusKm = watchlist.radius_km;
  if (centerLatitude != null && centerLongitude != null && radiusKm != null) {
    if (listing.latitude == null || listing.longitude == null) {
      unknown(state, "coordinates");
    } else {
      state.distanceKm = distanceKm(
        { latitude: centerLatitude, longitude: centerLongitude },
        { latitude: listing.latitude, longitude: listing.longitude },
      );
      if (state.distanceKm > radiusKm) reject(state, "radius_km");
      else state.reasons.push(`radius:${Math.round(state.distanceKm)}km`);
    }
  }

  const freshnessHours = watchlist.freshness_hours;
  const lastSeenAt = new Date(listing.last_seen_at);
  if (freshnessHours != null && !Number.isNaN(lastSeenAt.getTime())) {
    const ageHours = Math.max(0, (now.getTime() - lastSeenAt.getTime()) / 3_600_000);
    if (ageHours > freshnessHours) reject(state, "freshness");
    else state.reasons.push(`fresh:${Math.round(ageHours)}h`);
  }

  const searchText = listingSearchText(listing);
  if ((watchlist.keywords ?? []).length > 0) {
    if (!searchText) unknown(state, "keywords");
    else if (!watchlist.keywords.every((keyword) => searchText.includes(normalize(keyword)))) reject(state, "keywords");
    else state.reasons.push("keywords");
  }
  if ((watchlist.must_have_keywords ?? []).length > 0) {
    const visible = watchlist.must_have_keywords.filter((keyword) => !keyword.startsWith("__vehigo_"));
    if (visible.length > 0 && !searchText) unknown(state, "must_have_keywords");
    else if (visible.length > 0 && !visible.every((keyword) => searchText.includes(normalize(keyword)))) reject(state, "must_have_keywords");
    else if (visible.length > 0) state.reasons.push("must_have_keywords");
  }
  const excludedHit = (watchlist.excluded_keywords ?? []).find((keyword) => searchText.includes(normalize(keyword)));
  if (excludedHit) reject(state, `excluded:${excludedHit}`);

  const confidence = listing.normalization_confidence ?? 0.5;
  const score = Math.max(0, Math.min(100, Math.round(
    55 + state.reasons.length * 4 + confidence * 20 - state.unknownFields.length * 8,
  )));
  return {
    matches: state.rejectedBy === null,
    mode: state.mode,
    score,
    reasons: [...new Set(state.reasons)],
    unknownFields: [...new Set(state.unknownFields)],
    rejectedBy: state.rejectedBy,
    distanceKm: state.distanceKm === null ? null : Math.round(state.distanceKm * 10) / 10,
  };
}

/**
 * Discovery search may retain records with missing secondary attributes for
 * manual review. Notifications are intentionally stricter: every configured
 * commercial field must be present so an incomplete web snippet cannot become
 * a Telegram opportunity merely because it was returned first.
 */
export function isListingEligibleForNotification(
  listing: SearchListing,
  watchlist: SearchWatchlist,
  evaluation = evaluateListingForWatchlist(listing, watchlist),
) {
  if (!evaluation.matches) return false;
  if ((watchlist.min_price != null || watchlist.max_price != null || watchlist.target_price != null)
    && (listing.price == null || listing.currency !== watchlist.currency)) return false;
  if ((watchlist.min_year != null || watchlist.max_year != null) && listing.year == null) return false;
  if (watchlist.max_mileage_km != null && listing.mileage_km == null) return false;
  if (watchlist.vehicle_type && !listing.vehicle_type) return false;
  if (resolveCountryCodes(watchlist).length > 0
    && !(listing.seller_country_code ?? canonicalCountryCode(listing.seller_country))) return false;
  return true;
}

function matchesSource(listing: SearchListing, watchlist: SearchWatchlist) {
  const sourceKeys = watchlist.source_keys ?? [];
  if (sourceKeys.length === 0) return true;
  if (sourceKeys.includes(listing.source_key)) return true;
  return sourceKeys.includes("brave_web")
    && ["brave_web", "federated_search"].includes(readRawString(listing.raw, "discovery_channel") ?? "");
}

function knownFilter<T>(
  state: EvaluationState,
  field: string,
  enabled: boolean,
  actual: T | null | undefined,
  matches: (value: T) => boolean,
  requiredWhenConfigured = false,
) {
  if (!enabled || state.rejectedBy) return;
  if (actual === null || actual === undefined || actual === "") return unknown(state, field, requiredWhenConfigured);
  if (!matches(actual)) reject(state, field);
  else state.reasons.push(field);
}

function numberRange(state: EvaluationState, field: string, actual: number | null | undefined, min: number | null | undefined, max: number | null | undefined) {
  if (min == null && max == null) return;
  knownFilter(state, field, true, actual, (value) => (min == null || value >= min) && (max == null || value <= max), true);
}

function textFilter(
  state: EvaluationState,
  field: string,
  expected: string | null | undefined,
  actual: string | null | undefined,
  listing: SearchListing,
  allowTitleFallback = false,
  requiredWhenConfigured = false,
) {
  if (!expected || state.rejectedBy) return;
  const expectedText = normalize(expected);
  const actualText = normalize(actual ?? "");
  const fallback = allowTitleFallback ? normalize(listing.title ?? "") : listingSearchText(listing);
  if (!actualText && !fallback) return unknown(state, field, requiredWhenConfigured);
  if (!actualText.includes(expectedText) && !fallback.includes(expectedText)) reject(state, field);
  else state.reasons.push(field);
}

function categoricalFilter(
  state: EvaluationState,
  field: string,
  expected: string | null | undefined,
  actual: string | null | undefined,
  listing: SearchListing,
  terms: Record<string, string[]>,
) {
  if (!expected || state.rejectedBy) return;
  if (actual && actual !== "other" && actual !== "unknown") {
    if (actual !== expected) reject(state, field);
    else state.reasons.push(field);
    return;
  }
  const text = listingSearchText(listing);
  const detected = Object.entries(terms).find(([, candidates]) => candidates.some((candidate) => text.includes(normalize(candidate))))?.[0];
  if (!detected) return unknown(state, field);
  if (detected !== expected) reject(state, field);
  else state.reasons.push(field);
}

function unknown(state: EvaluationState, field: string, requiredWhenConfigured = false) {
  if (state.mode === "strict" || requiredWhenConfigured) reject(state, `unknown:${field}`);
  else state.unknownFields.push(field);
}

function reject(state: EvaluationState, reason: string) {
  state.rejectedBy ??= reason;
}

function listingSearchText(listing: SearchListing) {
  return normalize([
    listing.title, listing.description, listing.brand, listing.model, listing.variant,
    listing.seller_name, listing.seller_city, listing.seller_country,
    readRawString(listing.raw, "description"), readRawString(listing.raw, "subject"),
  ].filter(Boolean).join(" "));
}

function inferNumber(listing: SearchListing, pattern: RegExp) {
  const match = listingSearchText(listing).match(pattern);
  return match ? Number.parseInt(match[1], 10) : null;
}

function inferEngineCc(listing: SearchListing) {
  const text = listingSearchText(listing);
  const cc = text.match(/(\d{3,5})\s*(?:cc|cm3|cm³)\b/i);
  if (cc) return Number.parseInt(cc[1], 10);
  const liters = text.match(/\b(\d(?:[.,]\d))\s*(?:l|liter)\b/i);
  return liters ? Math.round(Number.parseFloat(liters[1].replace(",", ".")) * 1000) : null;
}

function readRawString(raw: Json | null, key: string) {
  if (!raw || Array.isArray(raw) || typeof raw !== "object") return null;
  const value = raw[key];
  return typeof value === "string" ? value : null;
}

function readRawNumber(raw: Json | null, key: string) {
  if (!raw || Array.isArray(raw) || typeof raw !== "object") return null;
  const value = raw[key];
  return typeof value === "number" ? value : null;
}

function stringWatchlistValue(watchlist: SearchWatchlist, key: string) {
  const dedicated = (watchlist as unknown as Record<string, unknown>)[key];
  if (typeof dedicated === "string" && dedicated) return dedicated;
  const directPrefix = key === "condition" ? "__vehigo_condition:" : `__vehigo_filter:${key}:`;
  const token = (watchlist.must_have_keywords ?? []).find((keyword) => keyword.startsWith(directPrefix));
  return token?.slice(directPrefix.length) || null;
}

function numericWatchlistValue(watchlist: SearchWatchlist, key: string) {
  const dedicated = (watchlist as unknown as Record<string, unknown>)[key];
  if (typeof dedicated === "number") return dedicated;
  const directPrefix = key === "seat_count" ? "__vehigo_seat:" : `__vehigo_filter:${key}:`;
  const token = (watchlist.must_have_keywords ?? []).find((keyword) => keyword.startsWith(directPrefix));
  if (!token) return null;
  const value = Number(token.slice(directPrefix.length));
  return Number.isFinite(value) ? value : null;
}

function normalize(value: string) {
  return value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("en-US").replace(/ı/g, "i").replace(/[_/|,;:()\[\]-]+/g, " ").replace(/\s+/g, " ").trim();
}

import { describe, expect, it } from "vitest";
import type { Database } from "@/lib/supabase/types";
import { distanceKm, resolveCountryCodes } from "@/lib/search/geography";
import { parseNaturalLanguageSearch } from "@/lib/search/search-plan";
import { evaluateListingForWatchlist } from "@/lib/search/matcher";
import { groupDuplicateListings, sortSearchResultCards } from "@/lib/search/results";

type Listing = Database["public"]["Tables"]["market_listings"]["Row"];
type Watchlist = Database["public"]["Tables"]["watchlists"]["Row"];

const listing = {
  id: "00000000-0000-4000-8000-000000000001",
  source_key: "mobile_de",
  source_listing_id: "mobile-1",
  listing_url: "https://example.com/1",
  title: "Volkswagen Golf 2.0 TDI automatic",
  seller_name: "Dealer",
  seller_country: "Germany",
  seller_country_code: "DE",
  seller_city: "Berlin",
  latitude: 52.52,
  longitude: 13.405,
  brand: "Volkswagen",
  model: "Golf",
  year: 2022,
  mileage_km: 48_000,
  price: 19_500,
  currency: "EUR",
  vehicle_type: "car",
  fuel_type: "diesel",
  transmission: "automatic",
  canonical_fingerprint: "v1_same",
  duplicate_cluster_id: "10000000-0000-4000-8000-000000000001",
  normalization_confidence: 0.9,
  raw: null,
  status: "active",
  delisted_at: null,
  first_seen_at: "2026-07-12T00:00:00.000Z",
  last_seen_at: "2026-07-12T00:00:00.000Z",
  created_at: "2026-07-12T00:00:00.000Z",
  updated_at: "2026-07-12T00:00:00.000Z",
} as Listing;

const watchlist = {
  id: "20000000-0000-4000-8000-000000000001",
  organization_id: "00000000-0000-4000-8000-000000000001",
  user_id: "30000000-0000-4000-8000-000000000001",
  name: "Golf Avrupa",
  active: true,
  source_keys: [],
  country: null,
  country_codes: ["DE", "NL"],
  region_preset: null,
  city: null,
  brand: "Volkswagen",
  model: "Golf",
  vehicle_type: "car",
  min_year: 2020,
  max_year: null,
  max_mileage_km: 80_000,
  min_price: null,
  max_price: 22_000,
  currency: "EUR",
  keywords: [],
  target_price: 21_000,
  must_have_keywords: [],
  excluded_keywords: [],
  search_mode: "discovery",
  freshness_hours: 168,
  sort_by: "relevance",
  sort_direction: "desc",
  page_size: 25,
  created_at: "2026-07-12T00:00:00.000Z",
  updated_at: "2026-07-12T00:00:00.000Z",
} as Watchlist;

describe("Phase 3 geography and planning", () => {
  it("expands presets and merges explicit countries without duplicates", () => {
    const codes = resolveCountryCodes({ country_codes: ["DE", "NL"], region_preset: "balkans" });
    expect(codes).toContain("DE");
    expect(codes).toContain("RS");
    expect(new Set(codes).size).toBe(codes.length);
  });

  it("calculates radius distance using the great-circle formula", () => {
    const berlinToHamburg = distanceKm(
      { latitude: 52.52, longitude: 13.405 },
      { latitude: 53.5511, longitude: 9.9937 },
    );
    expect(berlinToHamburg).toBeGreaterThan(250);
    expect(berlinToHamburg).toBeLessThan(270);
  });

  it("turns a multilingual sentence into a confirmable versioned plan", () => {
    const plan = parseNaturalLanguageSearch("Almanya ve Hollanda'da 2021 sonrası 80 bin km altında otomatik Volkswagen Golf dizel discovery");
    expect(plan).toMatchObject({
      version: 1,
      parserVersion: "deterministic-multilingual-v1",
      filters: {
        brand: "Volkswagen",
        model: "golf",
        country_codes: ["DE", "NL"],
        min_year: 2021,
        max_mileage_km: 80_000,
        transmission: "automatic",
        fuel_type: "diesel",
        search_mode: "discovery",
      },
    });
  });
});

describe("strict/discovery matching", () => {
  it("matches a known listing across a multi-country selection", () => {
    const result = evaluateListingForWatchlist(listing, watchlist, new Date("2026-07-13T00:00:00.000Z"));
    expect(result.matches).toBe(true);
    expect(result.unknownFields).toEqual([]);
    expect(result.reasons).toContain("country");
  });

  it("keeps unknown secondary data in discovery mode but rejects it in strict mode", () => {
    const unknownFuel = { ...listing, fuel_type: null, title: "Volkswagen Golf 2022" };
    const discovery = evaluateListingForWatchlist(unknownFuel, { ...watchlist, fuel_type: "diesel" }, new Date("2026-07-13T00:00:00.000Z"));
    const strict = evaluateListingForWatchlist(unknownFuel, { ...watchlist, fuel_type: "diesel", search_mode: "strict" }, new Date("2026-07-13T00:00:00.000Z"));
    expect(discovery.matches).toBe(true);
    expect(discovery.unknownFields).toContain("fuel_type");
    expect(strict.matches).toBe(false);
    expect(strict.rejectedBy).toBe("unknown:fuel_type");
  });

  it("applies radius filters and reports the computed distance", () => {
    const nearby = evaluateListingForWatchlist(listing, { ...watchlist, center_latitude: 52.5, center_longitude: 13.4, radius_km: 20 }, new Date("2026-07-13T00:00:00.000Z"));
    const outside = evaluateListingForWatchlist(listing, { ...watchlist, center_latitude: 53.5511, center_longitude: 9.9937, radius_km: 100 }, new Date("2026-07-13T00:00:00.000Z"));
    expect(nearby.matches).toBe(true);
    expect(nearby.distanceKm).toBeLessThan(5);
    expect(outside.matches).toBe(false);
    expect(outside.rejectedBy).toBe("radius_km");
  });
});

describe("deduplicated stable search results", () => {
  it("returns one primary card with cross-source alternatives", () => {
    const first = { listing, evaluation: evaluateListingForWatchlist(listing, watchlist, new Date("2026-07-13T00:00:00.000Z")) };
    const alternativeListing = { ...listing, id: "00000000-0000-4000-8000-000000000002", source_key: "autoscout24", listing_url: "https://example.com/2", normalization_confidence: 0.7 };
    const second = { listing: alternativeListing, evaluation: evaluateListingForWatchlist(alternativeListing, watchlist, new Date("2026-07-13T00:00:00.000Z")) };
    const cards = groupDuplicateListings([second, first]);
    expect(cards).toHaveLength(1);
    expect(cards[0].listing.id).toBe(listing.id);
    expect(cards[0].alternatives).toHaveLength(1);
  });

  it("uses listing id as a deterministic tie-breaker", () => {
    const evaluation = evaluateListingForWatchlist(listing, watchlist, new Date("2026-07-13T00:00:00.000Z"));
    const cards = groupDuplicateListings([
      { listing: { ...listing, id: "b", duplicate_cluster_id: null, canonical_fingerprint: null }, evaluation },
      { listing: { ...listing, id: "a", duplicate_cluster_id: null, canonical_fingerprint: null }, evaluation },
    ]);
    expect(sortSearchResultCards(cards, "relevance", "desc").map((card) => card.listing.id)).toEqual(["a", "b"]);
  });
});

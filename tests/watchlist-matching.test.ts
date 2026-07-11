import { describe, expect, it } from "vitest";
import type { Database } from "@/lib/supabase/types";
import { listingMatchesWatchlist } from "@/lib/services/market-alerts";

type Listing = Database["public"]["Tables"]["market_listings"]["Row"];
type Watchlist = Database["public"]["Tables"]["watchlists"]["Row"];

const baseListing: Listing = {
  id: "listing-1", source_key: "brave_web", source_listing_id: "source-1",
  listing_url: "https://example.com/car", title: "Volkswagen Golf 2022 passenger car",
  seller_name: null, seller_country: "Germany", seller_city: "Berlin", brand: "Volkswagen",
  model: "Golf", year: 2022, mileage_km: 42000, price: 18500, currency: "EUR",
  vehicle_type: "car", raw: null, status: "active", delisted_at: null,
  first_seen_at: "2026-07-11T00:00:00Z",
  last_seen_at: "2026-07-11T00:00:00Z", created_at: "2026-07-11T00:00:00Z",
  updated_at: "2026-07-11T00:00:00Z",
};

const baseWatchlist: Watchlist = {
  id: "watch-1", user_id: "user-1", name: "Golf Almanya", active: true,
  source_keys: ["brave_web"], country: "Germany", city: null, brand: "Volkswagen", model: "Golf",
  vehicle_type: "car", min_year: 2020, max_year: null, max_mileage_km: 80000,
  min_price: null, max_price: 22000, currency: "EUR", keywords: [], target_price: 21000,
  must_have_keywords: [], excluded_keywords: [], created_at: "2026-07-11T00:00:00Z",
  updated_at: "2026-07-11T00:00:00Z",
};

describe("listingMatchesWatchlist", () => {
  it("matches a small passenger car against the complete trader filter", () => {
    expect(listingMatchesWatchlist(baseListing, baseWatchlist)).toBe(true);
  });

  it("keeps listings with unknown price and mileage eligible for manual verification", () => {
    expect(listingMatchesWatchlist({ ...baseListing, price: null, mileage_km: null }, baseWatchlist)).toBe(true);
  });

  it("rejects a known price above the trader's maximum", () => {
    expect(listingMatchesWatchlist({ ...baseListing, price: 24000 }, baseWatchlist)).toBe(false);
  });

  it("infers a van type from an unstructured web result", () => {
    const vanListing = { ...baseListing, title: "Ford Transit transporter for sale", brand: "Ford", model: "Transit", vehicle_type: null };
    const vanWatchlist = { ...baseWatchlist, brand: "Ford", model: "Transit", vehicle_type: "van" as const };
    expect(listingMatchesWatchlist(vanListing, vanWatchlist)).toBe(true);
  });
});

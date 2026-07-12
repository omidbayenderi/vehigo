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
  vehicle_type: "car", raw: { vehigo_seat_count: 5, vehigo_condition: "used_good" }, status: "active", delisted_at: null,
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
  it("accepts a canonically attributed marketplace result discovered by selected Brave Deep Search", () => {
    const listing = { ...baseListing,
      source_key: "kleinanzeigen",
      raw: { discovery_channel: "brave_web", description: "Mercedes Actros truck" },
      brand: "Mercedes-Benz",
      model: "Actros",
    };
    const watchlist = { ...baseWatchlist, source_keys: ["brave_web"], brand: "Mercedes-Benz", model: "Actros" };

    expect(listingMatchesWatchlist(listing, watchlist)).toBe(true);
  });

  it("matches a small passenger car against the complete trader filter", () => {
    expect(listingMatchesWatchlist(baseListing, baseWatchlist)).toBe(true);
  });

  it("keeps listings with unknown price and mileage eligible for manual verification", () => {
    expect(listingMatchesWatchlist({ ...baseListing, price: null, mileage_km: null }, baseWatchlist)).toBe(true);
  });

  it("rejects a known price above the trader's maximum", () => {
    expect(listingMatchesWatchlist({ ...baseListing, price: 24000 }, baseWatchlist)).toBe(false);
  });

  it("matches a combined brand phrase when the structured brand is narrower but the title is exact", () => {
    const listing = { ...baseListing, title: "Toyota Corolla Kombi 2007", brand: "Toyota", model: "Corolla" };
    const watchlist = { ...baseWatchlist, brand: "Toyota Corolla", model: "Kombi", min_year: 2006, max_year: 2007 };

    expect(listingMatchesWatchlist({ ...listing, year: 2007 }, watchlist)).toBe(true);
  });

  it("infers a van type from an unstructured web result", () => {
    const vanListing = { ...baseListing, title: "Ford Transit transporter for sale", brand: "Ford", model: "Transit", vehicle_type: null };
    const vanWatchlist = { ...baseWatchlist, brand: "Ford", model: "Transit", vehicle_type: "van" as const };
    expect(listingMatchesWatchlist(vanListing, vanWatchlist)).toBe(true);
  });

  it("applies passenger-car seat count and condition filters when listing details are known", () => {
    expect(listingMatchesWatchlist(baseListing, { ...baseWatchlist, must_have_keywords: ["__vehigo_seat:5", "__vehigo_condition:used_good"] })).toBe(true);
    expect(listingMatchesWatchlist(baseListing, { ...baseWatchlist, must_have_keywords: ["__vehigo_seat:7"] })).toBe(false);
    expect(listingMatchesWatchlist(baseListing, { ...baseWatchlist, must_have_keywords: ["__vehigo_condition:damaged"] })).toBe(false);
  });

  it("keeps a listing eligible for manual verification when seat count or condition is unknown", () => {
    expect(listingMatchesWatchlist(
      { ...baseListing, raw: null },
      { ...baseWatchlist, must_have_keywords: ["__vehigo_seat:5", "__vehigo_condition:used_good"] },
    )).toBe(true);
  });

  it("uses visible must-have keywords as an OR inclusion rule", () => {
    const watchlist = { ...baseWatchlist, must_have_keywords: ["panoramic", "automatic"] };
    expect(listingMatchesWatchlist({ ...baseListing, title: "Volkswagen Golf automatic" }, watchlist)).toBe(true);
    expect(listingMatchesWatchlist({ ...baseListing, title: "Volkswagen Golf manual" }, watchlist)).toBe(false);
  });

  it("applies detailed mobile-style filters when the listing exposes the data", () => {
    const watchlist = {
      ...baseWatchlist,
      must_have_keywords: [
        "__vehigo_filter:fuel_type:diesel",
        "__vehigo_filter:transmission:automatic",
        "__vehigo_filter:min_power_hp:140",
        "__vehigo_filter:max_power_hp:200",
      ],
    };
    expect(listingMatchesWatchlist({ ...baseListing, title: "Volkswagen Golf diesel automatic 150 PS" }, watchlist)).toBe(true);
    expect(listingMatchesWatchlist({ ...baseListing, title: "Volkswagen Golf diesel manual 150 PS" }, watchlist)).toBe(false);
    expect(listingMatchesWatchlist({ ...baseListing, title: "Volkswagen Golf diesel automatic 220 PS" }, watchlist)).toBe(false);
  });
});

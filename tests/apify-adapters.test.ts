import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ScannerWatchlist } from "@/lib/scanner/adapters/types";
import { apifyAutoscout24Adapter, apifyMobileDeAdapter } from "@/lib/scanner/adapters/apify";

const watchlist = {
  active: true,
  brand: "Toyota",
  model: "Corolla",
  country: "Germany",
  vehicle_type: "car",
  min_year: 2020,
  max_year: null,
  min_price: null,
  max_price: 25_000,
  max_mileage_km: 80_000,
  keywords: [],
} as unknown as ScannerWatchlist;

describe("Apify vehicle adapters", () => {
  beforeEach(() => {
    process.env.APIFY_ENABLED = "true";
    process.env.APIFY_API_TOKEN = "test-token";
    process.env.APIFY_MAX_RESULTS_PER_RUN = "50";
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.APIFY_ENABLED;
    delete process.env.APIFY_API_TOKEN;
    delete process.env.APIFY_MAX_RESULTS_PER_RUN;
  });

  it("normalizes rich Mobile.de output without persisting provider-specific fields", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify([{
      id: "456789",
      url: "https://suchen.mobile.de/fahrzeuge/details.html?id=456789",
      title: "Toyota Corolla Hybrid",
      make: "Toyota",
      model: "Corolla",
      price: { amount: 21_500, currency: "EUR" },
      mileageKm: 42_000,
      firstRegistration: "05/2022",
      location: { country: "DE", city: "Berlin" },
      images: ["https://img.example/car.jpg"],
    }]), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const listings = await apifyMobileDeAdapter.fetchListings({ watchlists: [watchlist] });

    expect(listings).toHaveLength(1);
    expect(listings[0]).toMatchObject({
      source_key: "apify_mobile_de", source_listing_id: "456789", brand: "Toyota",
      model: "Corolla", year: 2022, mileage_km: 42_000, price: 21_500, seller_country_code: "DE",
    });
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("memo23~mobile-de-scraper/run-sync-get-dataset-items"),
      expect.objectContaining({ headers: expect.objectContaining({ Authorization: "Bearer test-token" }) }),
    );
  });

  it("sends structured watchlist filters to AutoScout24", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("[]", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await apifyAutoscout24Adapter.fetchListings({ watchlists: [watchlist] });

    const request = fetchMock.mock.calls[0][1] as RequestInit;
    expect(JSON.parse(String(request.body))).toMatchObject({
      make: "toyota", model: "corolla", countries: ["DE"], yearFrom: 2020,
      priceTo: 25_000, mileageTo: 80_000, maxResults: 50,
    });
  });

  it("does not call Apify when the production switch is off", async () => {
    process.env.APIFY_ENABLED = "false";
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await expect(apifyMobileDeAdapter.fetchListings({ watchlists: [watchlist] })).resolves.toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

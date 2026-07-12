import { afterEach, describe, expect, it, vi } from "vitest";
import { marktplaatsAdapter } from "@/lib/scanner/adapters/marktplaats";
import { braveWebAdapter, buildQueries, EUROPE_MARKETPLACE_HOSTS, sourceKeyForUrl } from "@/lib/scanner/adapters/brave-web";
import type { ScannerWatchlist } from "@/lib/scanner/adapters/types";

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.BRAVE_SEARCH_API_KEY;
});

function marktplaatsHtml(listings: unknown[]) {
  const nextData = { props: { pageProps: { searchRequestAndResponse: { listings } } } };
  return `<html><head><script id="__NEXT_DATA__" type="application/json">${JSON.stringify(nextData)}</script></head><body></body></html>`;
}

describe("marktplaatsAdapter", () => {
  it("maps a fixed-price listing into the shared MarketListingInput shape, converting price cents to euros", async () => {
    const html = marktplaatsHtml([
      {
        itemId: "m123",
        title: "Mercedes-Benz Actros 1845 LS",
        vipUrl: "/v/auto-s/vrachtwagens/m123",
        priceInfo: { priceCents: 3550000, priceType: "FIXED" },
        location: { cityName: "Rotterdam", countryName: "Nederland" },
        sellerInformation: { sellerName: "Truck Trader BV" },
        attributes: [
          { key: "constructionYear", value: "2019" },
          { key: "mileage", value: "480.000 km" },
          { key: "numberOfSeats", value: "2 zitplaatsen" },
          { key: "condition", value: "Gebruikt" },
        ],
      },
    ]);
    vi.stubGlobal("fetch", vi.fn().mockImplementation(() => Promise.resolve(new Response(html, { status: 200 }))));

    const listings = await marktplaatsAdapter.fetchListings({ watchlists: [] });

    expect(listings).toHaveLength(1);
    expect(listings[0]).toMatchObject({
      source_key: "marktplaats",
      source_listing_id: "m123",
      listing_url: "https://www.marktplaats.nl/v/auto-s/vrachtwagens/m123",
      brand: "Mercedes-Benz",
      year: 2019,
      mileage_km: 480000,
      price: 35500,
      currency: "EUR",
      vehicle_type: "truck",
      seat_count: 2,
      condition: "used_good",
    });
  });

  it("classifies a listing under a brand subcategory (not vrachtwagens/bestelauto-s) as a passenger car", async () => {
    const html = marktplaatsHtml([
      { itemId: "m789", title: "Toyota Corolla 1.8 Hybrid", vipUrl: "/v/auto-s/toyota/m789" },
    ]);
    vi.stubGlobal("fetch", vi.fn().mockImplementation(() => Promise.resolve(new Response(html, { status: 200 }))));

    const listings = await marktplaatsAdapter.fetchListings({ watchlists: [] });

    expect(listings[0]).toMatchObject({ brand: "Toyota", vehicle_type: "car" });
  });

  it("classifies a bestelauto-s listing as a van", async () => {
    const html = marktplaatsHtml([
      { itemId: "m321", title: "Mercedes-Benz Sprinter 311", vipUrl: "/v/auto-s/bestelauto-s/m321" },
    ]);
    vi.stubGlobal("fetch", vi.fn().mockImplementation(() => Promise.resolve(new Response(html, { status: 200 }))));

    const listings = await marktplaatsAdapter.fetchListings({ watchlists: [] });

    expect(listings[0].vehicle_type).toBe("van");
  });

  it("leaves price undefined for negotiable ('Bieden') listings instead of guessing", async () => {
    const html = marktplaatsHtml([
      {
        itemId: "m456",
        title: "DAF XF 106",
        vipUrl: "/v/auto-s/vrachtwagens/m456",
        priceInfo: { priceType: "SEE_DESCRIPTION" },
      },
    ]);
    vi.stubGlobal("fetch", vi.fn().mockImplementation(() => Promise.resolve(new Response(html, { status: 200 }))));

    const listings = await marktplaatsAdapter.fetchListings({ watchlists: [] });

    expect(listings[0].price).toBeUndefined();
  });

  it("dedupes a listing that appears in both the root and vrachtwagens category scans", async () => {
    const html = marktplaatsHtml([
      { itemId: "m999", title: "Scania R450", vipUrl: "/v/auto-s/vrachtwagens/m999" },
    ]);
    vi.stubGlobal("fetch", vi.fn().mockImplementation(() => Promise.resolve(new Response(html, { status: 200 }))));

    const listings = await marktplaatsAdapter.fetchListings({ watchlists: [] });

    expect(listings).toHaveLength(1);
  });

  it("adds a targeted Marktplaats search for each compatible active watchlist", async () => {
    const html = marktplaatsHtml([]);
    const fetchSpy = vi.fn().mockImplementation(() => Promise.resolve(new Response(html, { status: 200 })));
    vi.stubGlobal("fetch", fetchSpy);
    const watchlist = {
      brand: "Toyota",
      model: "Corolla",
      keywords: ["kombi", "Toyota"],
      source_keys: ["marktplaats"],
    } as ScannerWatchlist;

    await marktplaatsAdapter.fetchListings({ watchlists: [watchlist] });

    expect(fetchSpy).toHaveBeenCalledTimes(3);
    expect(fetchSpy.mock.calls.map(([url]) => url)).toContain(
      "https://www.marktplaats.nl/q/Toyota+Corolla+kombi/?sortBy=SORT_INDEX&sortOrder=DECREASING",
    );
  });

  it("throws a descriptive error when the page no longer has __NEXT_DATA__", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("<html>no data here</html>", { status: 200 })));

    await expect(marktplaatsAdapter.fetchListings({ watchlists: [] })).rejects.toThrow(
      "__NEXT_DATA__ bulunamadı",
    );
  });

  it("throws when the search request itself fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("", { status: 503 })));

    await expect(marktplaatsAdapter.fetchListings({ watchlists: [] })).rejects.toThrow("HTTP 503");
  });
});

describe("braveWebAdapter", () => {
  it("covers a broad European local-market catalogue and gives every watchlist an early query slot", () => {
    expect(EUROPE_MARKETPLACE_HOSTS.length).toBeGreaterThanOrEqual(40);
    const watchlists = Array.from({ length: 8 }, (_, index) => ({
      id: `watch-${index}`,
      name: `Watch ${index}`,
      brand: `Brand${index}`,
      model: `Model${index}`,
      vehicle_type: "car",
      country: null,
      city: null,
      keywords: [],
      source_keys: ["brave_web"],
    })) as unknown as ScannerWatchlist[];

    const firstRound = buildQueries(watchlists).slice(0, watchlists.length);
    expect(firstRound.map((plan) => plan.watchlist?.id)).toEqual(watchlists.map((watchlist) => watchlist.id));
  });

  it("does not spend web-search quota on a watchlist that opted out of Brave", () => {
    const watchlist = { source_keys: ["marktplaats"], keywords: [] } as unknown as ScannerWatchlist;
    expect(buildQueries([watchlist])).toEqual([]);
  });

  it("builds a targeted Brave query for a specifically selected marketplace source", () => {
    const watchlist = {
      id: "kleinanzeigen-watch",
      brand: "Volkswagen",
      model: "Golf",
      vehicle_type: "car",
      country: null,
      city: null,
      keywords: [],
      source_keys: ["kleinanzeigen"],
    } as unknown as ScannerWatchlist;

    const queries = buildQueries([watchlist]);
    expect(queries).toHaveLength(1);
    expect(queries[0].query).toContain("site:kleinanzeigen.de");
  });

  it("maps marketplace and public-social hostnames to canonical catalog source keys", () => {
    expect(sourceKeyForUrl("https://www.kleinanzeigen.de/s-anzeige/example/123")).toBe("kleinanzeigen");
    expect(sourceKeyForUrl("https://m.olx.pt/d/anuncio/example")).toBe("olx_pt");
    expect(sourceKeyForUrl("https://www.facebook.com/groups/cars/posts/123")).toBe("facebook_public");
    expect(sourceKeyForUrl("https://dealer.example/car/123")).toBe("brave_web");
  });

  it("throws without hitting the network when BRAVE_SEARCH_API_KEY is unset", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    await expect(braveWebAdapter.fetchListings({ watchlists: [] })).rejects.toThrow(
      "BRAVE_SEARCH_API_KEY tanımlı değil",
    );
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("keeps only results that look like a vehicle listing and dedupes repeated URLs", async () => {
    process.env.BRAVE_SEARCH_API_KEY = "test-key";
    const braveBody = {
      web: {
        results: [
          { title: "MAN TGX 18.500 for sale", url: "https://dealer.example/man-tgx", description: "used truck, 2 seats, te koop" },
          { title: "MAN TGX 18.500 for sale", url: "https://dealer.example/man-tgx", description: "duplicate" },
          { title: "Funny truck video", url: "https://youtube.com/watch?v=abc", description: "not a listing" },
        ],
      },
    };
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(() => Promise.resolve(new Response(JSON.stringify(braveBody), { status: 200 }))),
    );

    const listings = await braveWebAdapter.fetchListings({ watchlists: [] });

    expect(listings).toHaveLength(1);
    expect(listings[0]).toMatchObject({ source_key: "brave_web", listing_url: "https://dealer.example/man-tgx", seat_count: 2, condition: "used_good" });
  });

  it("attributes indexed results to their marketplace without copying watchlist location or type", async () => {
    process.env.BRAVE_SEARCH_API_KEY = "test-key";
    const braveBody = {
      web: { results: [{ title: "Volkswagen Golf occasion", url: "https://www.kleinanzeigen.de/s-anzeige/golf/123" }] },
    };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify(braveBody), { status: 200 })));
    const watchlist = {
      brand: "Volkswagen", model: "Golf", vehicle_type: "van", country: "Germany", city: "Berlin",
      keywords: [], source_keys: ["kleinanzeigen"],
    } as unknown as ScannerWatchlist;

    const listings = await braveWebAdapter.fetchListings({ watchlists: [watchlist] });

    expect(listings[0]).toMatchObject({ source_key: "kleinanzeigen", brand: "Volkswagen", model: "Golf" });
    expect(listings[0].seller_country).toBeUndefined();
    expect(listings[0].seller_city).toBeUndefined();
    expect(listings[0].vehicle_type).toBeUndefined();
    expect(listings[0].raw).toMatchObject({ discovery_channel: "brave_web", marketplace_host: "kleinanzeigen.de" });
  });

  it("keeps successful query results when another query in the same batch fails", async () => {
    process.env.BRAVE_SEARCH_API_KEY = "test-key";
    const successBody = {
      web: { results: [{ title: "Volkswagen Golf car for sale", url: "https://www.kleinanzeigen.de/s-anzeige/golf/456" }] },
    };
    const fetchSpy = vi.fn()
      .mockResolvedValueOnce(new Response("", { status: 429 }))
      .mockImplementation(() => Promise.resolve(new Response(JSON.stringify(successBody), { status: 200 })));
    vi.stubGlobal("fetch", fetchSpy);
    const watchlist = {
      brand: "Volkswagen", model: "Golf", vehicle_type: "car", country: null, city: null,
      keywords: [], source_keys: ["brave_web"],
    } as unknown as ScannerWatchlist;

    const listings = await braveWebAdapter.fetchListings({ watchlists: [watchlist] });
    expect(listings.some((listing) => listing.source_key === "kleinanzeigen")).toBe(true);
  });

  it("throws when the Brave API itself returns an error status", async () => {
    process.env.BRAVE_SEARCH_API_KEY = "test-key";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("", { status: 429 })));

    await expect(braveWebAdapter.fetchListings({ watchlists: [] })).rejects.toThrow("HTTP 429");
  });
});

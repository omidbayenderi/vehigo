import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { marktplaatsAdapter } from "@/lib/scanner/adapters/marktplaats";
import { braveWebAdapter, buildQueries, buildSiteAgentQueries, buildUnifiedSiteAgentQueries, EUROPE_MARKETPLACE_HOSTS, fetchSiteSearchAgentListings, sourceKeyForUrl } from "@/lib/scanner/adapters/brave-web";
import type { ScannerWatchlist } from "@/lib/scanner/adapters/types";

beforeEach(() => {
  process.env.BRAVE_SEARCH_STORAGE_RIGHTS_CONFIRMED = "true";
});

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.BRAVE_SEARCH_API_KEY;
  delete process.env.BRAVE_SEARCH_STORAGE_RIGHTS_CONFIRMED;
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

  it("routes a Marktplaats-only watchlist through its compliant web-index query", () => {
    const watchlist = { source_keys: ["marktplaats"], keywords: [] } as unknown as ScannerWatchlist;
    const queries = buildQueries([watchlist]);
    expect(queries).toHaveLength(1);
    expect(queries[0].query).toContain("site:marktplaats.nl");
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

  it("compiles multi-country watchlists into the remote discovery query", () => {
    const watchlist = {
      id: "multi-country-watch",
      brand: "Volkswagen",
      model: "Golf",
      vehicle_type: "car",
      country: null,
      country_codes: ["DE", "NL"],
      city: null,
      keywords: [],
      source_keys: ["brave_web"],
    } as unknown as ScannerWatchlist;
    const queries = buildQueries([watchlist]);
    expect(queries[0].query).toContain("Deutschland OR Nederland");
  });

  it("translates site-agent vehicle and detailed criteria into the marketplace language", () => {
    const watchlist = {
      id: "localized-watch",
      brand: "Volkswagen",
      model: "Golf",
      vehicle_type: "car",
      country: null,
      country_codes: ["DE"],
      region_preset: null,
      city: null,
      keywords: [],
      must_have_keywords: [],
      excluded_keywords: [],
      min_year: 2021,
      max_year: 2023,
      fuel_type: "diesel",
      transmission: "automatic",
      body_type: "station_wagon",
      source_keys: ["mobile_de"],
    } as unknown as ScannerWatchlist;

    const german = buildSiteAgentQueries({ sourceKey: "mobile_de", host: "mobile.de", watchlists: [watchlist], cursor: 0, limit: 1 });
    const dutch = buildSiteAgentQueries({ sourceKey: "marktplaats", host: "marktplaats.nl", watchlists: [{ ...watchlist, country_codes: ["NL"], source_keys: ["marktplaats"] }], cursor: 0, limit: 1 });

    expect(german.plans[0].query).toContain("site:mobile.de Volkswagen Golf Auto Deutschland Diesel Automatik Kombi (2021 OR 2022 OR 2023) (zu verkaufen OR gebraucht)");
    expect(dutch.plans[0].query).toContain("site:marktplaats.nl Volkswagen Golf auto Nederland diesel automaat stationwagen (2021 OR 2022 OR 2023) (te koop OR tweedehands)");
  });

  it("maps marketplace and public-social hostnames to canonical catalog source keys", () => {
    expect(sourceKeyForUrl("https://www.kleinanzeigen.de/s-anzeige/example/123")).toBe("kleinanzeigen");
    expect(sourceKeyForUrl("https://m.olx.pt/d/anuncio/example")).toBe("olx_pt");
    expect(sourceKeyForUrl("https://www.facebook.com/groups/cars/posts/123")).toBe("facebook_public");
    expect(sourceKeyForUrl("https://dealer.example/car/123")).toBe("brave_web");
  });

  it("builds isolated per-site queries and rotates the watchlist cursor", () => {
    const watchlists = ["Volvo", "Scania", "MAN"].map((brand, index) => ({
      id: `watch-${index}`,
      brand,
      model: null,
      vehicle_type: "truck",
      country: "Germany",
      country_codes: ["DE"],
      city: null,
      keywords: [],
      source_keys: ["mobile_de"],
    })) as unknown as ScannerWatchlist[];

    const result = buildSiteAgentQueries({ sourceKey: "mobile_de", host: "mobile.de", watchlists, cursor: 1, limit: 2 });
    expect(result.plans).toHaveLength(2);
    expect(result.plans.every((plan) => plan.query.includes("site:mobile.de"))).toBe(true);
    expect(result.plans[0].query).toContain("Scania");
    expect(result.nextCursor).toBe(0);
  });

  it("falls back to a generic site query when no watchlist targets the agent", () => {
    const unrelated = {
      vehicle_type: "car",
      keywords: [],
      source_keys: ["marktplaats"],
    } as unknown as ScannerWatchlist;

    const result = buildSiteAgentQueries({
      sourceKey: "mobile_de",
      host: "mobile.de",
      watchlists: [unrelated],
      cursor: 0,
      limit: 4,
    });

    expect(result.plans).toHaveLength(1);
    expect(result.plans[0]).toMatchObject({ watchlist: null });
    expect(result.plans[0].query).toContain("site:mobile.de LKW");
  });

  it("rotates all marketplace query groups through one unified agent budget", () => {
    const watchlist = {
      brand: "Volkswagen", model: "Golf", vehicle_type: "car",
      country_codes: ["DE"], keywords: [], source_keys: ["brave_web"],
    } as unknown as ScannerWatchlist;
    const first = buildUnifiedSiteAgentQueries({ watchlists: [watchlist], cursor: 0, limit: 4 });
    const second = buildUnifiedSiteAgentQueries({ watchlists: [watchlist], cursor: 4, limit: 4 });

    expect(first.plans).toHaveLength(4);
    expect(second.plans).toHaveLength(4);
    expect(first.candidateCount).toBeGreaterThan(8);
    expect(second.plans[0].query).not.toBe(first.plans[0].query);
  });

  it("attributes cross-domain results correctly when the unified Europe scout runs", async () => {
    process.env.BRAVE_SEARCH_API_KEY = "test-key";
    process.env.BRAVE_SEARCH_STORAGE_RIGHTS_CONFIRMED = "false";
    const body = {
      web: { results: [{ title: "MAN TGX truck for sale", url: "https://mobile.de/vehicle/unified-1" }] },
    };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status: 200 })));

    const result = await fetchSiteSearchAgentListings({
      sourceKey: "brave_web",
      host: "europe.marketplaces",
      watchlists: [],
      queryCursor: 0,
      maxQueries: 1,
      maxPages: 1,
      maxRequests: 1,
      processingMode: "transient_search",
    });

    expect(result.listings).toHaveLength(1);
    expect(result.listings[0]).toMatchObject({ source_key: "mobile_de" });
  });

  it("paginates one site agent only while Brave reports more results", async () => {
    process.env.BRAVE_SEARCH_API_KEY = "test-key";
    const page = (id: string, more: boolean) => ({
      query: { more_results_available: more },
      web: { results: [{ title: `MAN truck ${id} for sale`, url: `https://mobile.de/vehicle/${id}` }] },
    });
    const fetchSpy = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify(page("1", true)), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(page("2", false)), { status: 200 }));
    vi.stubGlobal("fetch", fetchSpy);

    const result = await fetchSiteSearchAgentListings({
      sourceKey: "mobile_de",
      host: "mobile.de",
      watchlists: [],
      queryCursor: 0,
      maxQueries: 1,
      maxPages: 3,
    });
    expect(result.pageCount).toBe(2);
    expect(result.listings.map((listing) => listing.source_listing_id)).toEqual([
      "https://mobile.de/vehicle/1",
      "https://mobile.de/vehicle/2",
    ]);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it("keeps the first page and marks the run partial when a later page fails", async () => {
    process.env.BRAVE_SEARCH_API_KEY = "test-key";
    const firstPage = {
      query: { more_results_available: true },
      web: { results: [{ title: "MAN truck for sale", url: "https://mobile.de/vehicle/partial-1" }] },
    };
    vi.stubGlobal("fetch", vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify(firstPage), { status: 200 }))
      .mockResolvedValueOnce(new Response("", { status: 503 })));

    const result = await fetchSiteSearchAgentListings({
      sourceKey: "mobile_de",
      host: "mobile.de",
      watchlists: [],
      queryCursor: 0,
      maxQueries: 1,
      maxPages: 2,
    });

    expect(result.partial).toBe(true);
    expect(result.pageCount).toBe(1);
    expect(result.listings[0].listing_url).toBe("https://mobile.de/vehicle/partial-1");
  });

  it("rejects an invalid agent host before calling Brave", async () => {
    process.env.BRAVE_SEARCH_API_KEY = "test-key";
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    await expect(fetchSiteSearchAgentListings({
      sourceKey: "mobile_de",
      host: "mobile.de/path",
      watchlists: [],
      queryCursor: 0,
      maxQueries: 1,
      maxPages: 1,
    })).rejects.toThrow("geçersiz host");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("does not persist a Brave result from outside the agent's assigned host", async () => {
    process.env.BRAVE_SEARCH_API_KEY = "test-key";
    const body = {
      web: { results: [{ title: "MAN truck for sale", url: "https://dealer.example/vehicle/1" }] },
    };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status: 200 })));

    const result = await fetchSiteSearchAgentListings({
      sourceKey: "mobile_de",
      host: "mobile.de",
      watchlists: [],
      queryCursor: 0,
      maxQueries: 1,
      maxPages: 1,
    });

    expect(result.listings).toEqual([]);
  });

  it("rejects non-HTTP and credential-bearing URLs even when the hostname matches", async () => {
    process.env.BRAVE_SEARCH_API_KEY = "test-key";
    const body = {
      web: {
        results: [
          { title: "MAN truck for sale", url: "javascript://mobile.de/%0Aalert(1)" },
          { title: "MAN truck for sale", url: "https://user:password@mobile.de/vehicle/1" },
        ],
      },
    };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status: 200 })));

    const result = await fetchSiteSearchAgentListings({
      sourceKey: "mobile_de",
      host: "mobile.de",
      watchlists: [],
      queryCursor: 0,
      maxQueries: 1,
      maxPages: 1,
    });

    expect(result.listings).toEqual([]);
  });

  it("canonicalizes tracking variants to one listing identity", async () => {
    process.env.BRAVE_SEARCH_API_KEY = "test-key";
    const body = {
      web: { results: [
        { title: "MAN truck for sale", url: "http://WWW.mobile.de/vehicle/42/?utm_source=x&b=2&a=1#photo" },
        { title: "MAN truck for sale", url: "https://mobile.de/vehicle/42?a=1&b=2" },
      ] },
    };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status: 200 })));

    const result = await fetchSiteSearchAgentListings({
      sourceKey: "mobile_de", host: "mobile.de", watchlists: [], queryCursor: 0, maxQueries: 1, maxPages: 1,
    });

    expect(result.listings).toHaveLength(1);
    expect(result.listings[0].source_listing_id).toBe("https://mobile.de/vehicle/42?a=1&b=2");
  });

  it("never exceeds the atomically reserved provider-request budget", async () => {
    process.env.BRAVE_SEARCH_API_KEY = "test-key";
    const page = {
      query: { more_results_available: true },
      web: { results: [{ title: "MAN truck for sale", url: "https://mobile.de/vehicle/budget" }] },
    };
    const fetchSpy = vi.fn().mockImplementation(
      () => Promise.resolve(new Response(JSON.stringify(page), { status: 200 })),
    );
    vi.stubGlobal("fetch", fetchSpy);

    const result = await fetchSiteSearchAgentListings({
      sourceKey: "mobile_de",
      host: "mobile.de",
      watchlists: [],
      queryCursor: 0,
      maxQueries: 4,
      maxPages: 10,
      maxRequests: 2,
    });

    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(result).toMatchObject({ requestCount: 2, queryCount: 1, pageCount: 2, partial: true });
  });

  it("extracts indexed year, mileage, price and market country so detailed filters can reject mismatches", async () => {
    process.env.BRAVE_SEARCH_API_KEY = "test-key";
    const braveBody = {
      web: {
        results: [{
          title: "Volkswagen Golf Variant 2022",
          url: "https://www.mobile.de/vehicle/criteria-1",
          description: "48.000 km · € 19.500 · Diesel · Automatik · 150 PS · 1968 cm3 · 5 Türen",
        }],
      },
    };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify(braveBody), { status: 200 })));
    const watchlist = {
      brand: "Volkswagen",
      model: "Golf",
      vehicle_type: "car",
      country: null,
      country_codes: ["DE"],
      region_preset: null,
      city: null,
      keywords: [],
      must_have_keywords: [],
      excluded_keywords: [],
      source_keys: ["mobile_de"],
    } as unknown as ScannerWatchlist;

    const result = await fetchSiteSearchAgentListings({
      sourceKey: "mobile_de",
      host: "mobile.de",
      watchlists: [watchlist],
      queryCursor: 0,
      maxQueries: 1,
      maxPages: 1,
    });

    expect(result.listings[0]).toMatchObject({
      year: 2022,
      mileage_km: 48_000,
      price: 19_500,
      currency: "EUR",
      seller_country_code: "DE",
      power_hp: 150,
      engine_cc: 1968,
      door_count: 5,
    });
  });

  it("throws without hitting the network when BRAVE_SEARCH_API_KEY is unset", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    await expect(braveWebAdapter.fetchListings({ watchlists: [] })).rejects.toThrow(
      "BRAVE_SEARCH_API_KEY tanımlı değil",
    );
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("refuses persistence-oriented search when contractual storage rights are not confirmed", async () => {
    process.env.BRAVE_SEARCH_API_KEY = "test-key";
    process.env.BRAVE_SEARCH_STORAGE_RIGHTS_CONFIRMED = "false";
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    await expect(braveWebAdapter.fetchListings({ watchlists: [] })).rejects.toThrow("saklama hakkı doğrulanmadı");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("permits site-agent search in transient mode without storage rights", async () => {
    process.env.BRAVE_SEARCH_API_KEY = "test-key";
    process.env.BRAVE_SEARCH_STORAGE_RIGHTS_CONFIRMED = "false";
    const braveBody = {
      web: { results: [{ title: "MAN truck for sale", url: "https://mobile.de/vehicle/transient" }] },
    };
    const fetchSpy = vi.fn().mockResolvedValue(new Response(JSON.stringify(braveBody), { status: 200 }));
    vi.stubGlobal("fetch", fetchSpy);

    const result = await fetchSiteSearchAgentListings({
      sourceKey: "mobile_de",
      host: "mobile.de",
      watchlists: [],
      queryCursor: 0,
      maxQueries: 1,
      maxPages: 1,
      processingMode: "transient_search",
    });

    expect(fetchSpy).toHaveBeenCalledOnce();
    expect(result.listings).toHaveLength(1);
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

  it("rejects an aggregator category page instead of treating it as one vehicle listing", async () => {
    process.env.BRAVE_SEARCH_API_KEY = "test-key";
    const braveBody = {
      web: {
        results: [
          {
            title: "Gasoline Toyota Corolla cars | Autoline Europe",
            url: "https://www.autoline.info/used/Toyota/Corolla",
            description: "Gasoline Toyota Corolla cars ▸ 66 offers ✓ Price from €1,800 ✓ New and used",
          },
          { title: "Toyota Corolla 1.6 kaufen", url: "https://www.autoscout24.com/offers/toyota-corolla-1", description: "used petrol Toyota Corolla for sale" },
        ],
      },
    };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify(braveBody), { status: 200 })));

    const listings = await braveWebAdapter.fetchListings({ watchlists: [] });

    expect(listings).toHaveLength(1);
    expect(listings[0].listing_url).toBe("https://autoscout24.com/offers/toyota-corolla-1");
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

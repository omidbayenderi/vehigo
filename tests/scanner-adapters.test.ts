import { afterEach, describe, expect, it, vi } from "vitest";
import { marktplaatsAdapter } from "@/lib/scanner/adapters/marktplaats";
import { braveWebAdapter } from "@/lib/scanner/adapters/brave-web";

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
          { title: "MAN TGX 18.500 for sale", url: "https://dealer.example/man-tgx", description: "used truck, te koop" },
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
    expect(listings[0]).toMatchObject({ source_key: "brave_web", listing_url: "https://dealer.example/man-tgx" });
  });

  it("throws when the Brave API itself returns an error status", async () => {
    process.env.BRAVE_SEARCH_API_KEY = "test-key";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("", { status: 429 })));

    await expect(braveWebAdapter.fetchListings({ watchlists: [] })).rejects.toThrow("HTTP 429");
  });
});

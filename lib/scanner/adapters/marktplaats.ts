import type { MarketListingInput } from "@/lib/services/market-alerts";
import type { ScanAdapter } from "./types";

const SEARCH_URL =
  "https://www.marktplaats.nl/l/auto-s/vrachtwagens/?sortBy=SORT_INDEX&sortOrder=DECREASING";

const USER_AGENT = "VehigoMarketScanner/1.0 (+https://vehigo.local; contact via app owner)";

const KNOWN_BRANDS = [
  "Mercedes-Benz",
  "Mercedes",
  "MAN",
  "DAF",
  "Volvo",
  "Scania",
  "Iveco",
  "Renault",
  "Ginaf",
  "Ford",
  "Isuzu",
  "Fiat",
  "Nissan",
  "Fuso",
  "Setra",
  "Neoplan",
  "Krone",
  "Schmitz",
  "Kögel",
  "VW",
  "Volkswagen",
];

type MarktplaatsListing = {
  itemId: string;
  title: string;
  vipUrl: string;
  priceInfo?: { priceCents?: number; priceType?: string };
  location?: { cityName?: string; countryName?: string };
  sellerInformation?: { sellerName?: string };
  attributes?: { key: string; value?: string }[];
};

function detectBrand(title: string): string | undefined {
  const lower = title.toLowerCase();
  return KNOWN_BRANDS.find((brand) => lower.includes(brand.toLowerCase()));
}

function attributeValue(listing: MarktplaatsListing, key: string): string | undefined {
  return listing.attributes?.find((attr) => attr.key === key)?.value;
}

function extractNextData(html: string): {
  props: { pageProps: { searchRequestAndResponse?: { listings?: MarktplaatsListing[] } } };
} {
  const match = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  if (!match) throw new Error("marktplaats: __NEXT_DATA__ bulunamadı (sayfa yapısı değişmiş olabilir)");
  return JSON.parse(match[1]);
}

export const marktplaatsAdapter: ScanAdapter = {
  key: "marktplaats",
  async fetchListings(): Promise<MarketListingInput[]> {
    const response = await fetch(SEARCH_URL, {
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "nl-NL,nl;q=0.9,en;q=0.8",
      },
    });

    if (!response.ok) {
      throw new Error(`marktplaats: HTTP ${response.status}`);
    }

    const html = await response.text();
    const data = extractNextData(html);
    const listings = data.props.pageProps.searchRequestAndResponse?.listings ?? [];

    return listings.map((listing): MarketListingInput => {
      const priceCents = listing.priceInfo?.priceCents;
      const isFixedPrice = listing.priceInfo?.priceType === "FIXED";
      const yearRaw = attributeValue(listing, "constructionYear");
      const mileageRaw = attributeValue(listing, "mileage");

      return {
        source_key: "marktplaats",
        source_listing_id: listing.itemId,
        listing_url: `https://www.marktplaats.nl${listing.vipUrl}`,
        title: listing.title,
        seller_name: listing.sellerInformation?.sellerName,
        seller_country: listing.location?.countryName,
        seller_city: listing.location?.cityName,
        brand: detectBrand(listing.title),
        year: yearRaw ? Number.parseInt(yearRaw, 10) : undefined,
        mileage_km: mileageRaw ? Number.parseInt(mileageRaw.replace(/\D/g, ""), 10) : undefined,
        price: isFixedPrice && priceCents !== undefined ? priceCents / 100 : undefined,
        currency: "EUR",
        vehicle_type: "truck",
        raw: listing as unknown as Record<string, unknown>,
      };
    });
  },
};

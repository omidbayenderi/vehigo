import type { MarketListingInput } from "@/lib/services/market-alerts";
import type { VehicleType } from "@/lib/supabase/types";
import { inferModel } from "@/lib/services/opportunity-flow";
import type { ScanAdapter } from "./types";

/**
 * "/l/auto-s/" is Marktplaats' whole car/van/truck tree — vrachtwagens (trucks) and
 * bestelauto-s (vans) are subcategories under it and also show up mixed into the root
 * feed. We scan the root (broad passenger-car coverage) plus a dedicated vrachtwagens
 * search (so trucks — the original point of this scanner — don't get diluted by the
 * much higher volume of passenger car listings). Overlap between the two is expected
 * and harmless: listings dedupe by source_listing_id downstream.
 */
const SEARCH_URLS = [
  "https://www.marktplaats.nl/l/auto-s/?sortBy=SORT_INDEX&sortOrder=DECREASING",
  "https://www.marktplaats.nl/l/auto-s/vrachtwagens/?sortBy=SORT_INDEX&sortOrder=DECREASING",
];

const USER_AGENT = "VehigoMarketScanner/1.0 (+https://vehigo.local; contact via app owner)";

const KNOWN_BRANDS = [
  // Ağır vasıta / kamyon
  "Mercedes-Benz",
  "Mercedes",
  "MAN",
  "DAF",
  "Volvo",
  "Scania",
  "Iveco",
  "Ginaf",
  "Isuzu",
  "Fuso",
  "Setra",
  "Neoplan",
  "Krone",
  "Schmitz",
  "Kögel",
  // Binek otomobil / van (Marktplaats "Auto's" kategori ağacından)
  "Volkswagen",
  "VW",
  "BMW",
  "Peugeot",
  "Audi",
  "Ford",
  "Renault",
  "Opel",
  "Kia",
  "Toyota",
  "Citroën",
  "Fiat",
  "Seat",
  "Mini",
  "Hyundai",
  "Skoda",
  "Nissan",
  "Suzuki",
  "Mazda",
  "Land Rover",
  "Mitsubishi",
  "Porsche",
  "Dacia",
  "Alfa Romeo",
  "Jeep",
  "Cupra",
  "Chevrolet",
  "Honda",
  "Tesla",
  "Lexus",
  "Jaguar",
];

// vipUrl'de bu segment görünürse gerçek tür oradan geliyor; kalanı (marka sayfaları,
// oldtimers, overige-auto-s vb.) hepsi kök "Auto's" ağacının parçası, yani binek.
const CATEGORY_VEHICLE_TYPE: Record<string, VehicleType> = {
  vrachtwagens: "truck",
  "bestelauto-s": "van",
};

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

function inferVehicleTypeFromVipUrl(vipUrl: string): VehicleType {
  // vipUrl: /v/auto-s/<category>/<slug> — category is index 3, not 2.
  const segment = vipUrl.split("/")[3];
  return CATEGORY_VEHICLE_TYPE[segment] ?? "car";
}

function extractNextData(html: string): {
  props: { pageProps: { searchRequestAndResponse?: { listings?: MarktplaatsListing[] } } };
} {
  const match = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  if (!match) throw new Error("marktplaats: __NEXT_DATA__ bulunamadı (sayfa yapısı değişmiş olabilir)");
  return JSON.parse(match[1]);
}

async function fetchCategory(url: string): Promise<MarktplaatsListing[]> {
  const response = await fetch(url, {
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
  return data.props.pageProps.searchRequestAndResponse?.listings ?? [];
}

export const marktplaatsAdapter: ScanAdapter = {
  key: "marktplaats",
  async fetchListings(): Promise<MarketListingInput[]> {
    const byItemId = new Map<string, MarktplaatsListing>();
    for (const url of SEARCH_URLS) {
      for (const listing of await fetchCategory(url)) {
        byItemId.set(listing.itemId, listing);
      }
    }

    return [...byItemId.values()].map((listing): MarketListingInput => {
      const priceCents = listing.priceInfo?.priceCents;
      const isFixedPrice = listing.priceInfo?.priceType === "FIXED";
      const yearRaw = attributeValue(listing, "constructionYear");
      const mileageRaw = attributeValue(listing, "mileage");
      const brand = detectBrand(listing.title);

      return {
        source_key: "marktplaats",
        source_listing_id: listing.itemId,
        listing_url: `https://www.marktplaats.nl${listing.vipUrl}`,
        title: listing.title,
        seller_name: listing.sellerInformation?.sellerName,
        seller_country: listing.location?.countryName,
        seller_city: listing.location?.cityName,
        brand,
        model: inferModel(listing.title, brand ?? null) ?? undefined,
        year: yearRaw ? Number.parseInt(yearRaw, 10) : undefined,
        mileage_km: mileageRaw ? Number.parseInt(mileageRaw.replace(/\D/g, ""), 10) : undefined,
        price: isFixedPrice && priceCents !== undefined ? priceCents / 100 : undefined,
        currency: "EUR",
        vehicle_type: inferVehicleTypeFromVipUrl(listing.vipUrl),
        raw: listing as unknown as Record<string, unknown>,
      };
    });
  },
};

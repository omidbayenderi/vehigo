import type { MarketListingInput } from "@/lib/domain/listings";
import type { VehicleCondition, VehicleType } from "@/lib/supabase/types";
import { inferModel } from "@/lib/services/opportunity-flow";
import type { ScanAdapter, ScannerWatchlist } from "./types";
import { resolveCountryCodes } from "@/lib/search/geography";

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
const MAX_WATCHLIST_SEARCHES = 20;

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

function inferSeatCount(listing: MarktplaatsListing): number | undefined {
  for (const key of ["numberOfSeats", "seats", "seatCount", "numberOfSeatsAndDoors"]) {
    const value = attributeValue(listing, key);
    const match = value?.match(/\d{1,2}/);
    if (match) return Number.parseInt(match[0], 10);
  }
  const match = listing.title.match(/(\d{1,2})\s*(?:zitplaatsen|zits|seats|koltuk)/i);
  return match ? Number.parseInt(match[1], 10) : undefined;
}

function inferCondition(listing: MarktplaatsListing): VehicleCondition | undefined {
  const text = `${attributeValue(listing, "condition") ?? ""} ${listing.title}`.toLowerCase();
  if (["schade", "beschadigd", "ongeval", "accident", "damaged"].some((term) => text.includes(term))) return "damaged";
  if (["zo goed als nieuw", "excellent", "topstaat"].some((term) => text.includes(term))) return "used_excellent";
  if (["nieuw", "new", "0 km", "ongebruikt"].some((term) => text.includes(term))) return "new";
  if (["gebruikt", "occasion", "used"].some((term) => text.includes(term))) return "used_good";
  return undefined;
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
    signal: AbortSignal.timeout(15_000),
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
  manifest: {
    key: "marktplaats",
    version: "1.0.0",
    displayName: "Marktplaats",
    countries: ["NL"],
    acquisitionModes: ["permitted_html"],
    vehicleTypes: ["car", "van", "truck", "trailer", "bus", "other"],
    fieldCoverage: [
      "source_key", "source_listing_id", "listing_url", "title", "seller_name",
      "seller_country", "seller_city", "brand", "model", "year", "mileage_km",
      "price", "currency", "vehicle_type", "seat_count", "condition", "raw",
    ],
    supportsDirectSearch: true,
    supportsIncrementalSync: false,
    persistencePolicy: "evidence_required",
    persistenceProviderKey: "marktplaats",
  },
  async fetchListings({ watchlists }): Promise<MarketListingInput[]> {
    const byItemId = new Map<string, MarktplaatsListing>();
    for (const url of buildSearchUrls(watchlists)) {
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
        seat_count: inferSeatCount(listing),
        condition: inferCondition(listing),
        raw: listing as unknown as Record<string, unknown>,
      };
    });
  },
};

function buildSearchUrls(watchlists: ScannerWatchlist[]) {
  const urls = new Set(SEARCH_URLS);

  for (const watchlist of watchlists) {
    if (
      watchlist.source_keys.length > 0 &&
      !watchlist.source_keys.includes("marktplaats")
    ) {
      continue;
    }
    const countryCodes = resolveCountryCodes(watchlist);
    if (countryCodes.length > 0 && !countryCodes.includes("NL")) continue;

    const query = [watchlist.brand, watchlist.model, ...watchlist.keywords]
      .map((part) => part?.trim())
      .filter((part): part is string => Boolean(part))
      .filter((part, index, parts) => parts.findIndex((candidate) => candidate.toLowerCase() === part.toLowerCase()) === index)
      .join(" ");
    if (!query) continue;

    const slug = encodeURIComponent(query).replaceAll("%20", "+");
    urls.add(`https://www.marktplaats.nl/q/${slug}/?sortBy=SORT_INDEX&sortOrder=DECREASING`);
    if (urls.size >= SEARCH_URLS.length + MAX_WATCHLIST_SEARCHES) break;
  }

  return [...urls];
}

import type { MarketListingInput } from "@/lib/services/market-alerts";
import type { VehicleCondition } from "@/lib/supabase/types";
import type { ScanAdapter, ScannerWatchlist } from "./types";

const ENDPOINT = "https://api.search.brave.com/res/v1/web/search";
const MAX_QUERIES_PER_RUN = 30;
const EUROPE_MARKETPLACE_HOSTS = [
  "mobile.de", "autoscout24.com", "truckscout24.com", "autoline.info",
  "truck1.eu", "leboncoin.fr", "autotrader.co.uk", "machineryline.com",
  "machineseeker.com", "wallapop.com", "trucksnl.com", "mascus.com",
  "agriaffaires.com", "europe-camions.com", "kleyntrucks.com", "basworld.com",
];
const EUROPE_MARKETPLACE_SITE_GROUPS = Array.from(
  { length: Math.ceil(EUROPE_MARKETPLACE_HOSTS.length / 4) },
  (_, index) => EUROPE_MARKETPLACE_HOSTS.slice(index * 4, index * 4 + 4),
);
const VEHICLE_TERMS: Record<string, string[]> = {
  car: ["car", "passenger car", "auto", "voiture", "personenwagen"],
  van: ["van", "light commercial vehicle", "transporter", "camionnette", "bestelwagen"],
  truck: ["truck", "lorry", "tractor unit", "vrachtwagen", "camion", "lastwagen"],
  trailer: ["trailer", "semi trailer", "auflieger", "remorque"],
  construction: ["excavator", "wheel loader", "construction machine", "baumaschine"],
  spare_part: ["truck parts", "spare parts", "ersatzteile"],
  bus: ["bus", "coach", "reisebus"],
  other: ["commercial vehicle", "utility vehicle"],
};

type BraveResult = {
  title?: string;
  url?: string;
  description?: string;
  age?: string;
  profile?: { name?: string };
};

type BraveResponse = {
  web?: {
    results?: BraveResult[];
  };
};

type QueryPlan = {
  query: string;
  watchlist: ScannerWatchlist | null;
};

export const braveWebAdapter: ScanAdapter = {
  key: "brave_web",
  async fetchListings({ watchlists }): Promise<MarketListingInput[]> {
    const token = process.env.BRAVE_SEARCH_API_KEY;
    if (!token) throw new Error("BRAVE_SEARCH_API_KEY tanımlı değil");

    const queries = buildQueries(watchlists);
    const listings: MarketListingInput[] = [];

    for (const plan of queries.slice(0, MAX_QUERIES_PER_RUN)) {
      const url = new URL(ENDPOINT);
      url.searchParams.set("q", plan.query);
      url.searchParams.set("count", "20");
      url.searchParams.set("safesearch", "off");
      url.searchParams.set("extra_snippets", "true");

      const response = await fetch(url, {
        headers: {
          Accept: "application/json",
          "X-Subscription-Token": token,
        },
      });

      if (!response.ok) {
        throw new Error(`brave_web: HTTP ${response.status}`);
      }

      const data = (await response.json()) as BraveResponse;
      for (const result of data.web?.results ?? []) {
        if (!result.url || !isLikelyVehicleListing(result.url, result.title, result.description)) continue;
        const inferredText = `${result.title ?? ""} ${result.description ?? ""} ${result.url}`;
        listings.push({
          source_key: "brave_web",
          source_listing_id: result.url,
          listing_url: result.url,
          title: result.title,
          seller_name: result.profile?.name,
          seller_country: plan.watchlist?.country ?? undefined,
          seller_city: plan.watchlist?.city ?? undefined,
          brand: plan.watchlist?.brand && textIncludes(inferredText, plan.watchlist.brand) ? plan.watchlist.brand : undefined,
          model: plan.watchlist?.model && textIncludes(inferredText, plan.watchlist.model) ? plan.watchlist.model : undefined,
          vehicle_type: inferVehicleType(inferredText) ?? plan.watchlist?.vehicle_type ?? undefined,
          seat_count: inferSeatCount(inferredText),
          condition: inferCondition(inferredText),
          raw: {
            query: plan.query,
            description: result.description,
            age: result.age,
            source: "brave_web",
            marketplace_host: new URL(result.url).hostname.replace(/^www\./, ""),
          },
        });
      }
    }

    return dedupeByUrl(listings);
  },
};

function buildQueries(watchlists: ScannerWatchlist[]): QueryPlan[] {
  const seen = new Set<string>();
  const queries: QueryPlan[] = [];
  const active = watchlists.length > 0 ? watchlists : [null];

  for (const watchlist of active) {
    const brandModel = watchlist ? [watchlist.brand, watchlist.model].filter(Boolean).join(" ") : "";
    const vehicleType = watchlist?.vehicle_type ?? "truck";
    const vehicleTerms = VEHICLE_TERMS[vehicleType] ?? VEHICLE_TERMS.truck;
    const location = [watchlist?.city, watchlist?.country].filter(Boolean).join(" ");
    const keywords = watchlist?.keywords.join(" ") ?? "";
    const baseParts = [
      location || "Europe",
      keywords,
      "(for sale OR kaufen OR te koop OR vendre OR occasion OR gebraucht OR used)",
    ].filter(Boolean);

    for (const term of vehicleTerms.slice(0, 2)) {
      const vehicleParts = brandModel ? [brandModel, term, ...baseParts] : [term, ...baseParts];
      const variants = [
        vehicleParts.join(" "),
        ...EUROPE_MARKETPLACE_SITE_GROUPS.map(
          (hosts) => `${vehicleParts.join(" ")} (${hosts.map((host) => `site:${host}`).join(" OR ")})`,
        ),
      ];

      for (const query of variants) {

        if (!seen.has(query)) {
          seen.add(query);
          queries.push({ query, watchlist });
        }
      }
    }
  }

  return queries;
}

function isLikelyVehicleListing(url: string, title?: string, description?: string) {
  const text = `${url} ${title ?? ""} ${description ?? ""}`.toLowerCase();
  if (text.includes("facebook.com") || text.includes("youtube.com") || text.includes("wikipedia.org")) return false;
  if (isKnownMarketplaceUrl(url)) return true;
  return [
    "truck",
    "lorry",
    "vrachtwagen",
    "camion",
    "lastwagen",
    "tractor unit",
    "trailer",
    "bus",
    "for sale",
    "te koop",
    "kaufen",
    "occasion",
    "used",
    "auto",
    "wagen",
    "fahrzeug",
    "voiture",
    "automobile",
  ].some((term) => text.includes(term));
}

function isKnownMarketplaceUrl(url: string) {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    return EUROPE_MARKETPLACE_HOSTS.some((allowed) => host === allowed || host.endsWith(`.${allowed}`));
  } catch {
    return false;
  }
}

function dedupeByUrl(listings: MarketListingInput[]) {
  const seen = new Set<string>();
  return listings.filter((listing) => {
    if (seen.has(listing.listing_url)) return false;
    seen.add(listing.listing_url);
    return true;
  });
}

function textIncludes(text: string, expected: string) {
  return text.toLocaleLowerCase("tr-TR").includes(expected.toLocaleLowerCase("tr-TR"));
}

function inferVehicleType(text: string): MarketListingInput["vehicle_type"] | undefined {
  const lower = text.toLowerCase();
  if (["trailer", "semi trailer", "auflieger", "remorque", "dorse"].some((term) => lower.includes(term))) return "trailer";
  if (["excavator", "wheel loader", "construction machine", "baumaschine", "iş makinesi"].some((term) => lower.includes(term))) return "construction";
  if (["spare parts", "truck parts", "ersatzteile", "yedek parça"].some((term) => lower.includes(term))) return "spare_part";
  if (["bus", "coach", "reisebus", "otobüs"].some((term) => lower.includes(term))) return "bus";
  if (["van", "transporter", "camionnette", "bestelwagen", "hafif ticari"].some((term) => lower.includes(term))) return "van";
  if (["truck", "lorry", "vrachtwagen", "camion", "lastwagen", "tractor unit", "kamyon"].some((term) => lower.includes(term))) return "truck";
  if (["car", "passenger car", "personenwagen", "voiture", "automobile", "otomobil"].some((term) => lower.includes(term))) return "car";
  return undefined;
}

function inferSeatCount(text: string) {
  const match = text.match(/(\d{1,2})\s*(?:seats?|sitze|places|zitplaatsen|posti|plazas|koltuk)/i);
  return match ? Number.parseInt(match[1], 10) : undefined;
}

function inferCondition(text: string): VehicleCondition | undefined {
  const lower = text.toLowerCase();
  if (["damaged", "accident", "schaden", "unfall", "accidenté", "schade", "kazalı"].some((term) => lower.includes(term))) return "damaged";
  if (["brand new", "new vehicle", "neuwagen", "véhicule neuf", "nieuw"].some((term) => lower.includes(term))) return "new";
  if (["like new", "excellent condition", "topzustand", "comme neuf"].some((term) => lower.includes(term))) return "used_excellent";
  if (["used", "occasion", "gebraucht", "tweedehands", "d'occasion"].some((term) => lower.includes(term))) return "used_good";
  return undefined;
}

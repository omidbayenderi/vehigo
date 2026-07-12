import type { MarketListingInput } from "@/lib/services/market-alerts";
import type { VehicleCondition } from "@/lib/supabase/types";
import type { ScanAdapter, ScannerWatchlist } from "./types";

const ENDPOINT = "https://api.search.brave.com/res/v1/web/search";
const REQUEST_TIMEOUT_MS = 12_000;
export const MAX_QUERIES_PER_RUN = 30;
export const EUROPE_MARKETPLACE_HOSTS = [
  "mobile.de", "autoscout24.com", "truckscout24.com", "autoline.info",
  "truck1.eu", "leboncoin.fr", "autotrader.co.uk", "machineryline.com",
  "machineseeker.com", "wallapop.com", "trucksnl.com", "mascus.com",
  "agriaffaires.com", "europe-camions.com", "kleyntrucks.com", "basworld.com",
  // Ülke bazlı yerel pazaryerleri — kayıt/e-posta gerekmeden Brave'in
  // site: operatörüyle taranır.
  "kleinanzeigen.de", "olx.pt", "olx.pl", "olx.ro", "olx.bg",
  "subito.it", "2dehands.be", "2ememain.be", "blocket.se", "car.gr",
  "coches.net", "milanuncios.com", "otomoto.pl", "bazos.cz", "sbazar.cz",
  "willhaben.at", "tutti.ch", "anibis.ch", "finn.no", "dba.dk", "nettiauto.com",
  "ss.com", "autoplius.lt", "auto24.ee", "bazaraki.com", "carandmotor.gr",
  "donedeal.ie", "adverts.ie", "njuskalo.hr", "bolha.com", "bazos.sk",
  "hasznaltauto.hu", "kupujemprodajem.com", "pazar3.mk", "mobile.bg",
];
const MARKETPLACE_SOURCE_BY_HOST: Record<string, string> = {
  "mobile.de": "mobile_de",
  "autoscout24.com": "autoscout24",
  "truckscout24.com": "truckscout24",
  "autoline.info": "autoline",
  "truck1.eu": "truck1",
  "leboncoin.fr": "leboncoin",
  "autotrader.co.uk": "autotrader_uk",
  "machineryline.com": "machineryline",
  "machineseeker.com": "machineseeker",
  "wallapop.com": "wallapop_es",
  "trucksnl.com": "trucksnl",
  "mascus.com": "mascus",
  "agriaffaires.com": "agriaffaires",
  "europe-camions.com": "europe_camions",
  "kleyntrucks.com": "kleyn_trucks",
  "basworld.com": "bas_world",
  "kleinanzeigen.de": "kleinanzeigen",
  "olx.pt": "olx_pt",
  "olx.pl": "olx_pl",
  "olx.ro": "olx_ro",
  "subito.it": "subito_it",
  "otomoto.pl": "otomoto_pl",
  "willhaben.at": "willhaben_at",
  "blocket.se": "blocket_se",
  "finn.no": "finn_no",
  "dba.dk": "dba_dk",
  "nettiauto.com": "nettiauto_fi",
  "donedeal.ie": "donedeal_ie",
  "hasznaltauto.hu": "hasznaltauto_hu",
  "njuskalo.hr": "njuskalo_hr",
  "bolha.com": "bolha_si",
  "auto24.ee": "auto24_ee",
  "autoplius.lt": "autoplius_lt",
  "ss.com": "ss_lv",
  "bazaraki.com": "bazaraki_cy",
  "facebook.com": "facebook_public",
  "t.me": "telegram_public",
};
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

    const plans = buildQueries(watchlists).slice(0, MAX_QUERIES_PER_RUN);
    const listings: MarketListingInput[] = [];
    let successfulQueries = 0;
    let firstFailure: unknown;

    for (let index = 0; index < plans.length; index += 4) {
      const batch = plans.slice(index, index + 4);
      const results = await Promise.allSettled(batch.map((plan) => fetchQuery(plan, token)));
      const successful = results.filter(
        (result): result is PromiseFulfilledResult<MarketListingInput[]> => result.status === "fulfilled",
      );
      successfulQueries += successful.length;
      listings.push(...successful.flatMap((result) => result.value));
      const failure = results.find((result): result is PromiseRejectedResult => result.status === "rejected");
      firstFailure ??= failure?.reason;
    }

    if (plans.length > 0 && successfulQueries === 0) {
      throw firstFailure instanceof Error ? firstFailure : new Error("brave_web: tüm sorgular başarısız");
    }

    return dedupeByUrl(listings);
  },
};

async function fetchQuery(plan: QueryPlan, token: string): Promise<MarketListingInput[]> {
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
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(`brave_web: HTTP ${response.status}`);
  }

  const data = (await response.json()) as BraveResponse;
  const listings: MarketListingInput[] = [];
  for (const result of data.web?.results ?? []) {
    if (!result.url || !isLikelyVehicleListing(result.url, result.title, result.description)) continue;
    const inferredText = `${result.title ?? ""} ${result.description ?? ""} ${result.url}`;
    const sourceKey = sourceKeyForUrl(result.url);
    listings.push({
      source_key: sourceKey,
      source_listing_id: result.url,
      listing_url: result.url,
      title: result.title,
      seller_name: result.profile?.name,
      brand: plan.watchlist?.brand && textIncludes(inferredText, plan.watchlist.brand) ? plan.watchlist.brand : undefined,
      model: plan.watchlist?.model && textIncludes(inferredText, plan.watchlist.model) ? plan.watchlist.model : undefined,
      vehicle_type: inferVehicleType(inferredText),
      seat_count: inferSeatCount(inferredText),
      condition: inferCondition(inferredText),
      raw: {
        query: plan.query,
        description: result.description,
        age: result.age,
        source: "brave_web",
        discovery_channel: "brave_web",
        marketplace_host: new URL(result.url).hostname.replace(/^www\./, ""),
      },
    });
  }
  return listings;
}

export function buildQueries(watchlists: ScannerWatchlist[]): QueryPlan[] {
  const seen = new Set<string>();
  const planGroups: QueryPlan[][] = [];
  const searchableSourceKeys = new Set(Object.values(MARKETPLACE_SOURCE_BY_HOST));
  const eligible = watchlists.filter((watchlist) =>
    watchlist.source_keys.length === 0 ||
    watchlist.source_keys.includes("brave_web") ||
    watchlist.source_keys.some((key) => searchableSourceKeys.has(key)),
  );
  const active = watchlists.length === 0 ? [null] : eligible;

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

    for (const term of vehicleTerms.slice(0, 1)) {
      const vehicleParts = brandModel ? [brandModel, term, ...baseParts] : [term, ...baseParts];
      const selectedSourceKeys = new Set(watchlist?.source_keys ?? []);
      const deepSearch = selectedSourceKeys.size === 0 || selectedSourceKeys.has("brave_web");
      const selectedHosts = deepSearch
        ? EUROPE_MARKETPLACE_HOSTS
        : EUROPE_MARKETPLACE_HOSTS.filter((host) => selectedSourceKeys.has(MARKETPLACE_SOURCE_BY_HOST[host]));
      const selectedHostGroups = Array.from(
        { length: Math.ceil(selectedHosts.length / 4) },
        (_, index) => selectedHosts.slice(index * 4, index * 4 + 4),
      );
      const variants = [
        ...(deepSearch ? [vehicleParts.join(" ")] : []),
        ...selectedHostGroups.map(
          (hosts) => `${vehicleParts.join(" ")} (${hosts.map((host) => `site:${host}`).join(" OR ")})`,
        ),
        ...(deepSearch || selectedSourceKeys.has("facebook_public") || selectedSourceKeys.has("telegram_public")
          ? [`${vehicleParts.join(" ")} (${[
              deepSearch || selectedSourceKeys.has("facebook_public") ? "(site:facebook.com/groups AND /posts/)" : null,
              deepSearch || selectedSourceKeys.has("telegram_public") ? "site:t.me" : null,
            ].filter(Boolean).join(" OR ")})`]
          : []),
      ];
      const group: QueryPlan[] = [];
      for (const query of variants) {
        if (!seen.has(query)) {
          seen.add(query);
          group.push({ query, watchlist });
        }
      }
      planGroups.push(group);
    }
  }

  // Interleave watchlists so a large marketplace catalogue cannot consume the
  // whole provider quota before later saved searches get a turn.
  const queries: QueryPlan[] = [];
  const longestGroup = Math.max(0, ...planGroups.map((group) => group.length));
  for (let variant = 0; variant < longestGroup; variant++) {
    for (const group of planGroups) {
      if (group[variant]) queries.push(group[variant]);
    }
  }
  return queries;
}

export function sourceKeyForUrl(url: string) {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    const knownHost = Object.keys(MARKETPLACE_SOURCE_BY_HOST).find(
      (candidate) => host === candidate || host.endsWith(`.${candidate}`),
    );
    return knownHost ? MARKETPLACE_SOURCE_BY_HOST[knownHost] : "brave_web";
  } catch {
    return "brave_web";
  }
}

function isLikelyVehicleListing(url: string, title?: string, description?: string) {
  const text = `${url} ${title ?? ""} ${description ?? ""}`.toLowerCase();
  if (text.includes("youtube.com") || text.includes("wikipedia.org")) return false;
  if (isPublicSocialListingUrl(url)) return true;
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

function isPublicSocialListingUrl(url: string) {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./, "");
    return (host === "facebook.com" && /\/groups\/[^/]+\/(?:posts|permalink)\//.test(parsed.pathname)) || host === "t.me";
  } catch {
    return false;
  }
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

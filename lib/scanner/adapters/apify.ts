import type { MarketListingInput } from "@/lib/domain/listings";
import type { ScanAdapter, ScannerWatchlist } from "./types";

const APIFY_API = "https://api.apify.com/v2";
const REQUEST_TIMEOUT_MS = 190_000;
const DEFAULT_MAX_RESULTS = 50;

type ApifyRecord = Record<string, unknown>;

export const apifyMobileDeAdapter = createApifyAdapter({
  key: "apify_mobile_de",
  displayName: "Mobile.de via Apify",
  countries: ["DE"],
  actorEnv: "APIFY_MOBILE_DE_ACTOR",
  defaultActor: "memo23/mobile-de-scraper",
  buildInput: (watchlists, limit) => ({
    startUrls: relevantWatchlists(watchlists, "DE", "apify_mobile_de").map((watchlist) => ({
      url: mobileDeSearchUrl(watchlist),
    })),
    maxItems: limit,
    moreResults: false,
    monitoringMode: false,
    maxConcurrency: 3,
  }),
});

export const apifyAutoscout24Adapter = createApifyAdapter({
  key: "apify_autoscout24",
  displayName: "AutoScout24 Europe via Apify",
  countries: ["DE", "AT", "BE", "FR", "IT", "NL", "ES", "LU"],
  actorEnv: "APIFY_AUTOSCOUT24_ACTOR",
  defaultActor: "blackfalcondata/autoscout24-scraper",
  buildInput: (watchlists, limit) => autoscoutInput(watchlists, limit),
});

export const apifyMarktplaatsAdapter = createApifyAdapter({
  key: "apify_marktplaats",
  displayName: "Marktplaats.nl via Apify",
  countries: ["NL"],
  actorEnv: "APIFY_MARKTPLAATS_ACTOR",
  defaultActor: "memo23/marktplaats-nl-scraper",
  buildInput: (watchlists, limit) => ({
    queries: marktplaatsQueries(watchlists),
    maxItems: limit,
    maxConcurrency: 3,
  }),
  defaultCountryCode: "NL",
});

function createApifyAdapter(config: {
  key: string;
  displayName: string;
  countries: string[];
  actorEnv: string;
  defaultActor: string;
  buildInput: (watchlists: ScannerWatchlist[], limit: number) => Record<string, unknown>;
  defaultCountryCode?: string;
}): ScanAdapter {
  return {
    key: config.key,
    manifest: {
      key: config.key,
      version: "1.0.0",
      displayName: config.displayName,
      countries: config.countries,
      acquisitionModes: ["authorized_automation"],
      vehicleTypes: ["car", "van", "truck", "tractor_unit", "trailer", "construction", "spare_part", "bus", "other"],
      fieldCoverage: [
        "source_key", "source_listing_id", "listing_url", "title", "description", "seller_name",
        "seller_country_code", "seller_city", "brand", "model", "year", "mileage_km", "price",
        "currency", "vehicle_type", "fuel_type", "transmission", "power_hp", "images", "raw",
      ],
      supportsDirectSearch: true,
      supportsIncrementalSync: false,
      persistencePolicy: "evidence_required",
      persistenceProviderKey: config.key,
    },
    async fetchListings({ watchlists }) {
      if (process.env.APIFY_ENABLED !== "true") return [];
      const token = process.env.APIFY_API_TOKEN;
      if (!token) throw new Error("apify_configuration_error: APIFY_API_TOKEN tanımlı değil");
      const actor = process.env[config.actorEnv] || config.defaultActor;
      const limit = maxResults();
      const input = config.buildInput(watchlists, limit);
      if (isEmptyActorInput(input)) return [];
      const records = await runActor(actor, token, input);
      const listings = dedupe(records.slice(0, limit).flatMap((record) => normalizeApifyRecord(record, config.key)));
      if (!config.defaultCountryCode) return listings;
      return listings.map((listing) => ({
        ...listing,
        seller_country_code: listing.seller_country_code ?? config.defaultCountryCode,
      }));
    },
  };
}

async function runActor(actor: string, token: string, input: Record<string, unknown>) {
  const actorId = actor.replace("/", "~");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(
      `${APIFY_API}/acts/${encodeURIComponent(actorId)}/run-sync-get-dataset-items?format=json&clean=true`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(input),
        signal: controller.signal,
        cache: "no-store",
      },
    );
    if (!response.ok) {
      const body = (await response.text()).slice(0, 300);
      throw new Error(`apify_provider_error: ${response.status} ${body}`);
    }
    const payload: unknown = await response.json();
    if (!Array.isArray(payload)) throw new Error("apify_contract_error: dataset yanıtı dizi değil");
    return payload.filter(isRecord);
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") throw new Error("apify_provider_timeout");
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function normalizeApifyRecord(record: ApifyRecord, sourceKey: string): MarketListingInput[] {
  const listing = isRecord(record.item) ? record.item : record;
  const url = stringValue(listing, ["url", "listingUrl", "listing_url", "detailUrl", "link"]);
  if (!url || !isHttpUrl(url)) return [];
  const priceObject = isRecord(listing.price) ? listing.price : undefined;
  const location = isRecord(listing.location) ? listing.location : undefined;
  const dealer = isRecord(listing.dealer) ? listing.dealer : undefined;
  const images = imageValues(listing);
  const firstRegistration = stringValue(listing, ["firstRegistration", "firstRegistrationDate", "registration"]);
  const year = numberValue(listing, ["year", "registrationYear"]) ?? yearFrom(firstRegistration);

  return [{
    source_key: sourceKey,
    source_listing_id: stringValue(listing, ["id", "listingId", "vehicleId", "adId", "itemId"]) ?? idFromUrl(url),
    listing_url: url,
    title: stringValue(listing, ["title", "name", "shortTitle"]),
    description: stringValue(listing, ["description", "subtitle", "subTitle"]),
    seller_name: stringValue(dealer ?? listing, ["name", "sellerName", "dealerName"]),
    seller_country_code: stringValue(location ?? listing, ["countryCode", "country"]),
    seller_city: stringValue(location ?? listing, ["city", "town", "cityName"]),
    seller_postal_code: stringValue(location ?? listing, ["zip", "postalCode"]),
    brand: stringValue(listing, ["make", "brand", "manufacturer"]),
    model: stringValue(listing, ["model", "modelName"]),
    variant: stringValue(listing, ["variant", "version"]),
    year,
    first_registration_date: firstRegistration,
    mileage_km: numberValue(listing, ["mileageKm", "mileage", "mileage_km"]),
    price: numberValue(priceObject ?? listing, ["amount", "value", "price", "priceAmount"]),
    currency: stringValue(priceObject ?? listing, ["currency", "currencyCode"]) ?? "EUR",
    fuel_type: fuelValue(stringValue(listing, ["fuelType", "fuel"])),
    transmission: transmissionValue(stringValue(listing, ["transmission", "gearbox"])),
    power_hp: numberValue(listing, ["powerHp", "horsePower", "hp"]),
    engine_cc: numberValue(listing, ["displacementCc", "engineCc"]),
    exterior_color: stringValue(listing, ["exteriorColor", "color"]),
    images,
    raw: listing,
  }];
}

function autoscoutInput(watchlists: ScannerWatchlist[], limit: number) {
  const selected = watchlists.filter((item) => item.active && sourceSelected(item, "apify_autoscout24"));
  const watchlist = selected.find((item) => item.vehicle_type === "car") ?? selected[0];
  if (!watchlist) return {};
  return {
    make: slug(watchlist.brand),
    model: slug(watchlist.model),
    countries: autoscoutCountries(watchlist),
    priceFrom: watchlist.min_price ?? undefined,
    priceTo: watchlist.max_price ?? undefined,
    yearFrom: watchlist.min_year ?? undefined,
    yearTo: watchlist.max_year ?? undefined,
    mileageTo: watchlist.max_mileage_km ?? undefined,
    maxResults: limit,
    includeDetails: true,
  };
}

const NL_VEHICLE_TERMS: Record<string, string> = {
  car: "auto", van: "bestelwagen", truck: "vrachtwagen", tractor_unit: "trekker",
  trailer: "oplegger", construction: "bouwmachine", spare_part: "onderdelen", bus: "bus", other: "voertuig",
};

function marktplaatsQueries(watchlists: ScannerWatchlist[]) {
  return relevantWatchlists(watchlists, "NL", "apify_marktplaats").map((watchlist) => {
    const vehicleTerm = NL_VEHICLE_TERMS[watchlist.vehicle_type ?? "other"] ?? NL_VEHICLE_TERMS.other;
    return [watchlist.brand, watchlist.model, vehicleTerm].filter(Boolean).join(" ");
  });
}

function mobileDeSearchUrl(watchlist: ScannerWatchlist) {
  const query = [watchlist.brand, watchlist.model, ...watchlist.keywords].filter(Boolean).join(" ");
  const params = new URLSearchParams({
    dam: "false", isSearchRequest: "true", ref: "srp", sb: "rel",
    s: watchlist.vehicle_type === "truck" ? "Truck" : "Car",
    vc: watchlist.vehicle_type === "truck" ? "Truck" : "Car",
  });
  if (query) params.set("ft", query);
  if (watchlist.min_year || watchlist.max_year) params.set("fr", `${watchlist.min_year ?? ""}:${watchlist.max_year ?? ""}`);
  if (watchlist.min_price || watchlist.max_price) params.set("p", `${watchlist.min_price ?? ""}:${watchlist.max_price ?? ""}`);
  if (watchlist.max_mileage_km) params.set("ml", `:${watchlist.max_mileage_km}`);
  return `https://suchen.mobile.de/fahrzeuge/search.html?${params}`;
}

function relevantWatchlists(watchlists: ScannerWatchlist[], countryCode: string, sourceKey: string) {
  const active = watchlists.filter((watchlist) => watchlist.active && sourceSelected(watchlist, sourceKey));
  const local = active.filter((watchlist) => !watchlist.country || countryMatches(watchlist.country, countryCode));
  return (local.length > 0 ? local : active).slice(0, 5);
}

function sourceSelected(watchlist: ScannerWatchlist, sourceKey: string) {
  if (!watchlist.source_keys?.length || watchlist.source_keys.includes(sourceKey)) return true;
  const canonicalSourceByConnector: Record<string, string> = {
    apify_mobile_de: "mobile_de",
    apify_autoscout24: "autoscout24",
    apify_marktplaats: "marktplaats",
  };
  const canonical = canonicalSourceByConnector[sourceKey];
  return Boolean(canonical && watchlist.source_keys.includes(canonical));
}

function autoscoutCountries(watchlist: ScannerWatchlist) {
  const supported = ["DE", "AT", "BE", "FR", "IT", "NL", "ES", "LU"];
  if (!watchlist.country) return supported;
  const match = supported.find((code) => countryMatches(watchlist.country!, code));
  return match ? [match] : supported;
}

function countryMatches(value: string, code: string) {
  const normalized = value.trim().toUpperCase();
  const names: Record<string, string[]> = {
    DE: ["DE", "GERMANY", "DEUTSCHLAND", "ALMANYA"], AT: ["AT", "AUSTRIA", "ÖSTERREICH", "AVUSTURYA"],
    BE: ["BE", "BELGIUM", "BELÇİKA"], FR: ["FR", "FRANCE", "FRANSA"], IT: ["IT", "ITALY", "ITALIA", "İTALYA"],
    NL: ["NL", "NETHERLANDS", "HOLLAND", "HOLLANDA"], ES: ["ES", "SPAIN", "ESPAÑA", "İSPANYA"], LU: ["LU", "LUXEMBOURG", "LÜKSEMBURG"],
  };
  return names[code]?.includes(normalized) ?? normalized === code;
}

function maxResults() {
  const parsed = Number.parseInt(process.env.APIFY_MAX_RESULTS_PER_RUN ?? "", 10);
  return Number.isFinite(parsed) ? Math.min(100, Math.max(1, parsed)) : DEFAULT_MAX_RESULTS;
}

function isEmptyActorInput(input: Record<string, unknown>) {
  if (Object.keys(input).length === 0) return true;
  return (["startUrls", "queries"] as const).some((key) => Array.isArray(input[key]) && input[key].length === 0);
}

function isRecord(value: unknown): value is ApifyRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function stringValue(record: ApifyRecord | undefined, keys: string[]) {
  if (!record) return undefined;
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return undefined;
}

function numberValue(record: ApifyRecord | undefined, keys: string[]) {
  if (!record) return undefined;
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string") {
      const parsed = Number(value.replace(/[^0-9,.-]/g, "").replace(/\.(?=\d{3}(?:\D|$))/g, "").replace(",", "."));
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return undefined;
}

function imageValues(record: ApifyRecord) {
  const raw = record.images ?? record.imageUrls ?? record.imgUrls;
  const values = Array.isArray(raw) ? raw : typeof record.primaryImage === "string" ? [record.primaryImage] : [];
  const images = values.flatMap((value, position) => {
    const url = typeof value === "string" ? value : isRecord(value) ? stringValue(value, ["url", "src"]) : undefined;
    return url && isHttpUrl(url) ? [{ url, position }] : [];
  });
  return images.length > 0 ? images : undefined;
}

function fuelValue(value?: string): MarketListingInput["fuel_type"] {
  const text = value?.toLowerCase();
  if (!text) return undefined;
  if (text.includes("diesel")) return "diesel";
  if (text.includes("electric") || text.includes("elektro")) return "electric";
  if (text.includes("hybrid")) return "hybrid";
  if (text.includes("petrol") || text.includes("gasoline") || text.includes("benzin")) return "gasoline";
  if (text.includes("lpg")) return "lpg";
  return "other";
}

function transmissionValue(value?: string): MarketListingInput["transmission"] {
  const text = value?.toLowerCase();
  if (!text) return undefined;
  if (text.includes("auto")) return "automatic";
  if (text.includes("manual") || text.includes("schalt")) return "manual";
  return "other";
}

function slug(value: string | null) {
  return value?.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || undefined;
}

function yearFrom(value?: string) {
  const match = value?.match(/(?:19|20)\d{2}/);
  return match ? Number(match[0]) : undefined;
}

function idFromUrl(url: string) {
  return url.match(/(?:id=|\/)(\d{5,})(?:\D|$)/)?.[1];
}

function isHttpUrl(value: string) {
  try { return ["http:", "https:"].includes(new URL(value).protocol); } catch { return false; }
}

function dedupe(listings: MarketListingInput[]) {
  return [...new Map(listings.map((listing) => [listing.listing_url, listing])).values()];
}

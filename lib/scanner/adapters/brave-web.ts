import type { MarketListingInput } from "@/lib/domain/listings";
import type { VehicleCondition } from "@/lib/supabase/types";
import type { ScanAdapter, ScannerWatchlist } from "./types";
import { geographySearchTerms, resolveCountryCodes } from "@/lib/search/geography";
import type { FederatedSearchCache } from "@/lib/scanner/search-providers/cache";
import { routedVehicleSearch } from "@/lib/scanner/search-providers/router";
import { FEDERATED_SEARCH_PROVIDERS } from "@/lib/scanner/search-providers/providers";
import type { FederatedSearchHit } from "@/lib/scanner/search-providers/types";

export const UNIFIED_SITE_AGENT_SOURCE_KEY = "brave_web";
export const MAX_QUERIES_PER_RUN = 30;
export const EUROPE_MARKETPLACE_HOSTS = [
  "mobile.de", "autoscout24.com", "autoscout24.de", "autoscout24.nl", "autoscout24.be",
  "autoscout24.fr", "autoscout24.it", "autoscout24.at", "autoscout24.es",
  "truckscout24.com", "autoline.info", "marktplaats.nl",
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
  "alle-lkw.de", "truckstore.com", "machinerypark.com", "machinery-portal.com",
  "traktorpool.de", "rbauction.eu",
];
export const MARKETPLACE_SOURCE_BY_HOST: Record<string, string> = {
  "mobile.de": "mobile_de",
  "autoscout24.com": "autoscout24",
  "autoscout24.de": "autoscout24",
  "autoscout24.nl": "autoscout24",
  "autoscout24.be": "autoscout24",
  "autoscout24.fr": "autoscout24",
  "autoscout24.it": "autoscout24",
  "autoscout24.at": "autoscout24",
  "autoscout24.es": "autoscout24",
  "truckscout24.com": "truckscout24",
  "autoline.info": "autoline",
  "marktplaats.nl": "marktplaats",
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
  "alle-lkw.de": "alle_lkw_de",
  "truckstore.com": "truckstore",
  "machinerypark.com": "machinerypark",
  "machinery-portal.com": "machinery_portal",
  "traktorpool.de": "traktorpool",
  "rbauction.eu": "ritchie_bros",
};
const VEHICLE_TERMS: Record<string, string[]> = {
  car: ["car", "passenger car", "auto", "voiture", "personenwagen"],
  van: ["van", "light commercial vehicle", "transporter", "camionnette", "bestelwagen"],
  truck: ["truck", "lorry", "vrachtwagen", "camion", "lastwagen"],
  tractor_unit: ["tractor unit", "articulated truck", "semi truck", "sattelzugmaschine", "tracteur routier", "trekker"],
  trailer: ["trailer", "semi trailer", "auflieger", "remorque"],
  construction: ["excavator", "wheel loader", "construction machine", "baumaschine"],
  spare_part: ["truck parts", "spare parts", "ersatzteile"],
  bus: ["bus", "coach", "reisebus"],
  other: ["commercial vehicle", "utility vehicle"],
};
const ANY_VEHICLE_QUERY = "(car OR van OR truck OR tractor OR trailer OR bus OR excavator OR parts)";

type LocalSearchProfile = {
  sale: string;
  vehicles: Partial<Record<string, string>>;
  filters?: Record<string, string>;
};

const ENGLISH_SEARCH_PROFILE: LocalSearchProfile = {
  sale: "(for sale OR used)",
  vehicles: { car: "car", van: "van", truck: "truck", tractor_unit: "tractor unit", trailer: "trailer", construction: "construction machine", spare_part: "spare parts", bus: "bus", other: "vehicle" },
  filters: { automatic: "automatic", manual: "manual", semi_automatic: "semi automatic", gasoline: "petrol", diesel: "diesel", electric: "electric", hybrid: "hybrid", new: "new", used_excellent: "like new", used_good: "used", used_fair: "used", damaged: "damaged", sedan: "saloon", suv: "SUV", station_wagon: "estate", hatchback: "hatchback", coupe: "coupe", convertible: "convertible", pickup: "pickup", van: "van", fwd: "front wheel drive", rwd: "rear wheel drive", awd: "4x4", private: "private seller", dealer: "dealer" },
};

const LOCAL_SEARCH_PROFILES: Record<string, LocalSearchProfile> = {
  DE: { sale: "(zu verkaufen OR gebraucht)", vehicles: { car: "Auto", van: "Transporter", truck: "LKW", tractor_unit: "Sattelzugmaschine", trailer: "Auflieger", construction: "Baumaschine", spare_part: "Ersatzteile", bus: "Bus" }, filters: { automatic: "Automatik", manual: "Schaltgetriebe", semi_automatic: "Halbautomatik", gasoline: "Benzin", diesel: "Diesel", electric: "Elektro", hybrid: "Hybrid", new: "Neuwagen", used_excellent: "Topzustand", used_good: "Gebrauchtwagen", used_fair: "fahrbereit", damaged: "Unfallwagen", sedan: "Limousine", suv: "SUV", station_wagon: "Kombi", hatchback: "Schrägheck", coupe: "Coupé", convertible: "Cabrio", pickup: "Pickup", van: "Transporter", fwd: "Frontantrieb", rwd: "Heckantrieb", awd: "Allrad", private: "Privatanbieter", dealer: "Händler" } },
  NL: { sale: "(te koop OR tweedehands)", vehicles: { car: "auto", van: "bestelwagen", truck: "vrachtwagen", tractor_unit: "trekker", trailer: "oplegger", construction: "bouwmachine", spare_part: "onderdelen", bus: "bus" }, filters: { automatic: "automaat", manual: "handgeschakeld", semi_automatic: "halfautomaat", gasoline: "benzine", diesel: "diesel", electric: "elektrisch", hybrid: "hybride", new: "nieuw", used_excellent: "zo goed als nieuw", used_good: "gebruikt", used_fair: "rijdbaar", damaged: "schadeauto", sedan: "sedan", suv: "SUV", station_wagon: "stationwagen", hatchback: "hatchback", coupe: "coupé", convertible: "cabrio", pickup: "pickup", van: "bestelwagen", fwd: "voorwielaandrijving", rwd: "achterwielaandrijving", awd: "vierwielaandrijving", private: "particulier", dealer: "autobedrijf" } },
  FR: { sale: "(à vendre OR occasion)", vehicles: { car: "voiture", van: "utilitaire", truck: "camion", tractor_unit: "tracteur routier", trailer: "remorque", construction: "engin de chantier", spare_part: "pièces détachées", bus: "autobus" }, filters: { automatic: "automatique", manual: "manuelle", semi_automatic: "semi-automatique", gasoline: "essence", diesel: "diesel", electric: "électrique", hybrid: "hybride", new: "neuf", used_excellent: "comme neuf", used_good: "occasion", used_fair: "roulant", damaged: "accidenté", sedan: "berline", suv: "SUV", station_wagon: "break", hatchback: "hayon", coupe: "coupé", convertible: "cabriolet", pickup: "pick-up", van: "utilitaire", fwd: "traction", rwd: "propulsion", awd: "4x4", private: "particulier", dealer: "professionnel" } },
  IT: { sale: "(in vendita OR usato)", vehicles: { car: "auto", van: "furgone", truck: "camion", tractor_unit: "trattore stradale", trailer: "rimorchio", construction: "macchina edile", spare_part: "ricambi", bus: "autobus" }, filters: { automatic: "automatico", manual: "manuale", semi_automatic: "semiautomatico", gasoline: "benzina", diesel: "diesel", electric: "elettrica", hybrid: "ibrida", new: "nuovo", used_good: "usato", damaged: "incidentato", sedan: "berlina", suv: "SUV", station_wagon: "familiare", hatchback: "due volumi", coupe: "coupé", convertible: "cabrio", pickup: "pick-up", van: "furgone", awd: "4x4", private: "privato", dealer: "concessionario" } },
  ES: { sale: "(en venta OR segunda mano)", vehicles: { car: "coche", van: "furgoneta", truck: "camión", tractor_unit: "cabeza tractora", trailer: "remolque", construction: "maquinaria de construcción", spare_part: "recambios", bus: "autobús" }, filters: { automatic: "automático", manual: "manual", semi_automatic: "semiautomático", gasoline: "gasolina", diesel: "diésel", electric: "eléctrico", hybrid: "híbrido", new: "nuevo", used_good: "segunda mano", damaged: "accidentado", sedan: "berlina", suv: "SUV", station_wagon: "familiar", hatchback: "compacto", coupe: "cupé", convertible: "descapotable", pickup: "pickup", van: "furgoneta", awd: "4x4", private: "particular", dealer: "profesional" } },
  PL: { sale: "(na sprzedaż OR używany)", vehicles: { car: "samochód", van: "furgon", truck: "ciężarówka", trailer: "naczepa", construction: "maszyna budowlana", spare_part: "części", bus: "autobus" }, filters: { automatic: "automat", manual: "manualna", gasoline: "benzyna", diesel: "diesel", electric: "elektryczny", hybrid: "hybryda", new: "nowy", used_good: "używany", damaged: "uszkodzony", station_wagon: "kombi", awd: "4x4", private: "prywatny", dealer: "dealer" } },
  PT: { sale: "(à venda OR usado)", vehicles: { car: "carro", van: "carrinha", truck: "camião", trailer: "reboque", construction: "máquina de construção", spare_part: "peças", bus: "autocarro" }, filters: { automatic: "automático", manual: "manual", gasoline: "gasolina", diesel: "gasóleo", electric: "elétrico", hybrid: "híbrido", new: "novo", used_good: "usado", damaged: "acidentado", station_wagon: "carrinha", awd: "4x4", private: "particular", dealer: "profissional" } },
  RO: { sale: "(de vânzare OR second hand)", vehicles: { car: "mașină", van: "dubă", truck: "camion", trailer: "semiremorcă", construction: "utilaj", spare_part: "piese", bus: "autobuz" }, filters: { automatic: "automată", manual: "manuală", gasoline: "benzină", diesel: "diesel", electric: "electrică", hybrid: "hibrid", new: "nou", used_good: "second hand", damaged: "avariat", station_wagon: "break", awd: "4x4", private: "persoană fizică", dealer: "dealer" } },
  CZ: { sale: "(na prodej OR ojeté)", vehicles: { car: "auto", van: "dodávka", truck: "nákladní auto", trailer: "návěs", construction: "stavební stroj", spare_part: "náhradní díly", bus: "autobus" }, filters: { automatic: "automat", manual: "manuál", gasoline: "benzín", diesel: "nafta", electric: "elektrické", hybrid: "hybrid", new: "nové", used_good: "ojeté", damaged: "havarované", station_wagon: "kombi", awd: "4x4", private: "soukromý", dealer: "prodejce" } },
  SE: { sale: "(till salu OR begagnad)", vehicles: { car: "bil", van: "skåpbil", truck: "lastbil", trailer: "släp", construction: "entreprenadmaskin", spare_part: "reservdelar", bus: "buss" }, filters: { automatic: "automat", manual: "manuell", gasoline: "bensin", diesel: "diesel", electric: "elbil", hybrid: "hybrid", new: "ny", used_good: "begagnad", damaged: "krockskadad", station_wagon: "kombi", awd: "fyrhjulsdrift", private: "privat", dealer: "handlare" } },
  NO: { sale: "(til salgs OR brukt)", vehicles: { car: "bil", van: "varebil", truck: "lastebil", trailer: "tilhenger", construction: "anleggsmaskin", spare_part: "reservedeler", bus: "buss" }, filters: { automatic: "automat", manual: "manuell", gasoline: "bensin", diesel: "diesel", electric: "elbil", hybrid: "hybrid", new: "ny", used_good: "brukt", damaged: "skadet", station_wagon: "stasjonsvogn", awd: "firehjulsdrift", private: "privat", dealer: "forhandler" } },
  DK: { sale: "(til salg OR brugt)", vehicles: { car: "bil", van: "varevogn", truck: "lastbil", trailer: "anhænger", construction: "entreprenørmaskine", spare_part: "reservedele", bus: "bus" }, filters: { automatic: "automatgear", manual: "manuel", gasoline: "benzin", diesel: "diesel", electric: "elbil", hybrid: "hybrid", new: "ny", used_good: "brugt", damaged: "skadet", station_wagon: "stationcar", awd: "firehjulstræk", private: "privat", dealer: "forhandler" } },
  FI: { sale: "(myydään OR käytetty)", vehicles: { car: "auto", van: "pakettiauto", truck: "kuorma-auto", trailer: "perävaunu", construction: "työkone", spare_part: "varaosat", bus: "linja-auto" }, filters: { automatic: "automaatti", manual: "manuaali", gasoline: "bensiini", diesel: "diesel", electric: "sähköauto", hybrid: "hybridi", new: "uusi", used_good: "käytetty", damaged: "kolaroitu", station_wagon: "farmari", awd: "neliveto", private: "yksityinen", dealer: "liike" } },
  GR: { sale: "(πωλείται OR μεταχειρισμένο)", vehicles: { car: "αυτοκίνητο", van: "βαν", truck: "φορτηγό", trailer: "ρυμουλκούμενο", construction: "μηχάνημα έργου", spare_part: "ανταλλακτικά", bus: "λεωφορείο" }, filters: { automatic: "αυτόματο", manual: "χειροκίνητο", gasoline: "βενζίνη", diesel: "πετρέλαιο", electric: "ηλεκτρικό", hybrid: "υβριδικό", new: "καινούριο", used_good: "μεταχειρισμένο", damaged: "τρακαρισμένο", awd: "4x4", private: "ιδιώτης", dealer: "έμπορος" } },
  BG: { sale: "(продава OR втора употреба)", vehicles: { car: "автомобил", van: "бус", truck: "камион", trailer: "ремарке", construction: "строителна машина", spare_part: "части", bus: "автобус" } },
  SK: { sale: "(na predaj OR jazdené)", vehicles: { car: "auto", van: "dodávka", truck: "nákladné auto", trailer: "náves", construction: "stavebný stroj", spare_part: "náhradné diely", bus: "autobus" } },
  HU: { sale: "(eladó OR használt)", vehicles: { car: "autó", van: "furgon", truck: "teherautó", trailer: "pótkocsi", construction: "munkagép", spare_part: "alkatrész", bus: "busz" } },
  HR: { sale: "(na prodaju OR rabljeno)", vehicles: { car: "automobil", van: "kombi", truck: "kamion", trailer: "prikolica", construction: "građevinski stroj", spare_part: "dijelovi", bus: "autobus" } },
  SI: { sale: "(naprodaj OR rabljeno)", vehicles: { car: "avto", van: "kombi", truck: "tovornjak", trailer: "prikolica", construction: "gradbeni stroj", spare_part: "deli", bus: "avtobus" } },
  RS: { sale: "(na prodaju OR polovno)", vehicles: { car: "automobil", van: "kombi", truck: "kamion", trailer: "prikolica", construction: "građevinska mašina", spare_part: "delovi", bus: "autobus" } },
  MK: { sale: "(се продава OR половно)", vehicles: { car: "автомобил", van: "комбе", truck: "камион", trailer: "приколка", construction: "градежна машина", spare_part: "делови", bus: "автобус" } },
  EE: { sale: "(müüa OR kasutatud)", vehicles: { car: "auto", van: "kaubik", truck: "veoauto", trailer: "haagis", construction: "ehitusmasin", spare_part: "varuosad", bus: "buss" } },
  LV: { sale: "(pārdod OR lietots)", vehicles: { car: "auto", van: "furgons", truck: "kravas auto", trailer: "piekabe", construction: "būvtehnika", spare_part: "rezerves daļas", bus: "autobuss" } },
  LT: { sale: "(parduodamas OR naudotas)", vehicles: { car: "automobilis", van: "furgonas", truck: "sunkvežimis", trailer: "priekaba", construction: "statybinė technika", spare_part: "dalys", bus: "autobusas" } },
};

const HOST_MARKET_COUNTRY: Record<string, string> = {
  "mobile.de": "DE", "autoscout24.de": "DE", "truckscout24.com": "DE", "machineseeker.com": "DE", "kleinanzeigen.de": "DE", "alle-lkw.de": "DE",
  "truckstore.com": "DE", "machinery-portal.com": "DE", "traktorpool.de": "DE", "machinerypark.com": "NL",
  "marktplaats.nl": "NL", "autoscout24.nl": "NL", "trucksnl.com": "NL", "kleyntrucks.com": "NL", "basworld.com": "NL",
  "autoscout24.be": "BE", "autoscout24.at": "AT", "leboncoin.fr": "FR", "autoscout24.fr": "FR", "agriaffaires.com": "FR",
  "subito.it": "IT", "autoscout24.it": "IT", "wallapop.com": "ES", "autoscout24.es": "ES", "coches.net": "ES", "milanuncios.com": "ES",
  "olx.pt": "PT", "olx.pl": "PL", "otomoto.pl": "PL", "olx.ro": "RO", "olx.bg": "BG", "mobile.bg": "BG",
  "bazos.cz": "CZ", "sbazar.cz": "CZ", "bazos.sk": "SK", "willhaben.at": "AT", "2dehands.be": "BE", "2ememain.be": "BE",
  "blocket.se": "SE", "finn.no": "NO", "dba.dk": "DK", "nettiauto.com": "FI", "car.gr": "GR", "carandmotor.gr": "GR",
  "ss.com": "LV", "autoplius.lt": "LT", "auto24.ee": "EE", "bazaraki.com": "CY", "donedeal.ie": "IE", "adverts.ie": "IE",
  "njuskalo.hr": "HR", "bolha.com": "SI", "hasznaltauto.hu": "HU", "kupujemprodajem.com": "RS", "pazar3.mk": "MK",
  "autotrader.co.uk": "GB",
};

const HOST_QUERY_PROFILE: Record<string, string> = {
  ...HOST_MARKET_COUNTRY,
  "2dehands.be": "NL",
  "2ememain.be": "FR",
  "willhaben.at": "DE",
};

type QueryPlan = {
  query: string;
  watchlist: ScannerWatchlist | null;
};

export type SiteAgentSearchResult = {
  listings: MarketListingInput[];
  requestCount: number;
  queryCount: number;
  pageCount: number;
  nextCursor: number;
  partial: boolean;
};

export const braveWebAdapter: ScanAdapter = {
  key: "brave_web",
  manifest: {
    key: "brave_web",
    version: "1.0.0",
    displayName: "Europe Deep Search",
    countries: ["EU", "GB", "CH", "NO"],
    acquisitionModes: ["web_index"],
    vehicleTypes: ["car", "van", "truck", "tractor_unit", "trailer", "construction", "spare_part", "bus", "other"],
    fieldCoverage: [
      "source_key", "source_listing_id", "listing_url", "title", "seller_name",
      "brand", "model", "vehicle_type", "seat_count", "condition", "raw",
    ],
    supportsDirectSearch: true,
    supportsIncrementalSync: false,
    persistencePolicy: "evidence_required",
    persistenceProviderKey: "brave_web",
  },
  async fetchListings({ watchlists, processingMode }): Promise<MarketListingInput[]> {
    const token = requireBraveSearchConfiguration(processingMode !== "transient");

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

export async function fetchSiteSearchAgentListings(input: {
  sourceKey: string;
  host: string;
  watchlists: ScannerWatchlist[];
  queryCursor: number;
  maxQueries: number;
  maxPages: number;
  maxRequests?: number;
  onRequestAttempt?: () => void;
  processingMode?: "transient_search" | "persistent_search";
  cache?: FederatedSearchCache;
}): Promise<SiteAgentSearchResult> {
  const token = requireBraveSearchConfiguration(input.processingMode !== "transient_search");
  const unified = input.sourceKey === UNIFIED_SITE_AGENT_SOURCE_KEY;
  const host = input.host.trim().toLowerCase().replace(/^www\./, "");
  if (!/^[a-z0-9.-]+$/.test(host)) throw new Error("site_agent: geçersiz host");

  const selection = unified
    ? buildUnifiedSiteAgentQueries({
      watchlists: input.watchlists,
      cursor: input.queryCursor,
      limit: input.maxQueries,
    })
    : buildSiteAgentQueries({
      sourceKey: input.sourceKey,
      host,
      watchlists: input.watchlists,
      cursor: input.queryCursor,
      limit: Math.max(1, Math.min(input.maxQueries, 30)),
    });
  const { plans, startCursor, candidateCount } = selection;
  const listings: MarketListingInput[] = [];
  const requestLimit = Math.max(1, Math.min(input.maxRequests ?? input.maxQueries * input.maxPages, 300));
  // In the unified router the second reserved request is a provider fallback,
  // not another page from the same provider. Per-site legacy agents keep their
  // original pagination semantics.
  const pageLimit = unified ? 1 : Math.max(1, Math.min(input.maxPages, 10));
  let requestCount = 0;
  let queryCount = 0;
  let pageCount = 0;
  let partial = false;

  agentQueries: for (const plan of plans) {
    let attemptedQuery = false;
    for (let offset = 0; offset < pageLimit; offset += 1) {
      if (requestCount >= requestLimit) {
        partial = partial || offset > 0 || queryCount < plans.length;
        break agentQueries;
      }
      try {
        if (!attemptedQuery) {
          queryCount += 1;
          attemptedQuery = true;
        }
        const page = await fetchQueryPage(
          plan,
          token,
          offset,
          unified ? undefined : { sourceKey: input.sourceKey, host },
          {
            cache: input.cache,
            maxProviderRequests: requestLimit - requestCount,
            onProviderRequest: () => {
              requestCount += 1;
              input.onRequestAttempt?.();
            },
          },
        );
        listings.push(...page.listings);
        pageCount += 1;
        if (!page.moreResultsAvailable) break;
      } catch (error) {
        partial = listings.length > 0;
        if (!partial) throw error;
        break;
      }
    }
  }

  return {
    listings: dedupeByUrl(listings),
    requestCount,
    queryCount,
    pageCount,
    nextCursor: (startCursor + queryCount) % candidateCount,
    partial,
  };
}

export function buildUnifiedSiteAgentQueries(input: {
  watchlists: ScannerWatchlist[];
  cursor: number;
  limit: number;
}) {
  const planned = buildQueries(input.watchlists);
  const candidates = planned.length > 0 ? planned : buildQueries([]);
  const limit = Math.max(1, Math.min(input.limit, MAX_QUERIES_PER_RUN));
  const startCursor = input.cursor % candidates.length;
  const plans = Array.from(
    { length: Math.min(limit, candidates.length) },
    (_, index) => candidates[(startCursor + index) % candidates.length],
  );
  return {
    plans,
    startCursor,
    candidateCount: candidates.length,
    nextCursor: (startCursor + plans.length) % candidates.length,
  };
}

export function buildSiteAgentQueries(input: {
  sourceKey: string;
  host: string;
  watchlists: ScannerWatchlist[];
  cursor: number;
  limit: number;
}) {
  const eligible = input.watchlists.filter((watchlist) =>
    watchlist.source_keys.length === 0
    || watchlist.source_keys.includes("brave_web")
    || watchlist.source_keys.includes(input.sourceKey),
  );
  const candidates = eligible.length > 0 ? eligible : [null];
  const plans: QueryPlan[] = [];
  const limit = Math.max(1, Math.min(input.limit, 30));
  const start = input.cursor % candidates.length;

  for (let index = 0; index < Math.min(limit, candidates.length); index += 1) {
    const watchlist = candidates[(start + index) % candidates.length];
    const vehicleType = watchlist?.vehicle_type;
    const profileCode = mappedHostValue(input.host, HOST_QUERY_PROFILE) ?? resolveCountryCodes(watchlist ?? {})[0];
    const profile = localSearchProfile(profileCode);
    const vehicleTerm = vehicleType
      ? profile.vehicles[vehicleType] ?? (VEHICLE_TERMS[vehicleType] ?? VEHICLE_TERMS.other)[0]
      : ANY_VEHICLE_QUERY;
    const brandModel = [watchlist?.brand, watchlist?.model].filter(Boolean).join(" ");
    const geography = watchlist ? geographySearchTerms(watchlist).slice(0, 4).join(" OR ") : "";
    const keywords = watchlist?.keywords.slice(0, 6).join(" ") ?? "";
    const criteria = watchlist ? watchlistQueryCriteria(watchlist, profile) : [];
    const query = [
      `site:${input.host}`,
      brandModel,
      vehicleTerm,
      geography,
      keywords,
      ...criteria,
      profile.sale,
    ].filter(Boolean).join(" ");
    plans.push({ query, watchlist });
  }

  return {
    plans,
    nextCursor: (start + plans.length) % candidates.length,
    startCursor: start,
    candidateCount: candidates.length,
  };
}

function requireBraveSearchConfiguration(requiresStorageRights = true) {
  const configured = Object.values(FEDERATED_SEARCH_PROVIDERS).some((provider) => provider.configured());
  if (!configured) throw new Error("Federated Search sağlayıcı anahtarı tanımlı değil");
  const legacyBraveOnlyPermission = FEDERATED_SEARCH_PROVIDERS.brave.configured()
    && !FEDERATED_SEARCH_PROVIDERS.exa.configured()
    && !FEDERATED_SEARCH_PROVIDERS.tavily.configured()
    && !FEDERATED_SEARCH_PROVIDERS.vertex.configured()
    && process.env.BRAVE_SEARCH_STORAGE_RIGHTS_CONFIRMED === "true";
  if (requiresStorageRights && process.env.FEDERATED_SEARCH_STORAGE_RIGHTS_CONFIRMED !== "true" && !legacyBraveOnlyPermission) {
    throw new Error("Federated Search sonuçlarını saklama hakkı doğrulanmadı; FEDERATED_SEARCH_STORAGE_RIGHTS_CONFIRMED=true gerekli");
  }
  return "configured";
}

async function fetchQuery(plan: QueryPlan, token: string): Promise<MarketListingInput[]> {
  return (await fetchQueryPage(plan, token, 0)).listings;
}

async function fetchQueryPage(
  plan: QueryPlan,
  _token: string,
  offset: number,
  expected?: { sourceKey: string; host: string },
  execution?: {
    cache?: FederatedSearchCache;
    maxProviderRequests?: number;
    onProviderRequest?: () => void;
  },
) {
  const routed = await routedVehicleSearch({
    query: plan.query,
    watchlist: plan.watchlist,
    offset,
    maxResults: 20,
    cache: execution?.cache,
    maxProviderRequests: execution?.maxProviderRequests,
    onProviderRequest: execution?.onProviderRequest,
    scoreHits: (hits) => mapFederatedHits(hits, plan, expected).length,
  });
  return {
    listings: mapFederatedHits(routed.hits, plan, expected, routed.providersAttempted),
    moreResultsAvailable: routed.moreResultsAvailable,
  };
}

function mapFederatedHits(
  hits: FederatedSearchHit[],
  plan: QueryPlan,
  expected?: { sourceKey: string; host: string },
  providersAttempted: string[] = [],
) {
  const listings: MarketListingInput[] = [];
  for (const result of hits) {
    const listingUrl = result.url ? validatedListingUrl(result.url, expected?.host) : null;
    if (!listingUrl || !isLikelyVehicleListing(listingUrl, result.title, result.description)) continue;
    const inferredText = `${result.title ?? ""} ${result.description ?? ""} ${listingUrl}`;
    const sourceKey = expected?.sourceKey ?? sourceKeyForUrl(listingUrl);
    const inferred = inferIndexedListingFields(inferredText);
    const marketplaceHost = new URL(listingUrl).hostname.replace(/^www\./, "");
    listings.push({
      source_key: sourceKey,
      source_listing_id: listingUrl,
      listing_url: listingUrl,
      title: result.title,
      description: result.description,
      seller_name: result.profileName,
      seller_country_code: mappedHostValue(marketplaceHost, HOST_MARKET_COUNTRY),
      brand: plan.watchlist?.brand && textIncludes(inferredText, plan.watchlist.brand) ? plan.watchlist.brand : undefined,
      model: plan.watchlist?.model && textIncludes(inferredText, plan.watchlist.model) ? plan.watchlist.model : undefined,
      year: inferred.year,
      mileage_km: inferred.mileageKm,
      price: inferred.price,
      currency: inferred.currency,
      power_hp: inferred.powerHp,
      engine_cc: inferred.engineCc,
      door_count: inferred.doorCount,
      vehicle_type: inferVehicleType(inferredText),
      seat_count: inferSeatCount(inferredText),
      condition: inferCondition(inferredText),
      raw: {
        query: plan.query,
        description: result.description,
        age: result.age,
        source: "federated_search",
        discovery_channel: "federated_search",
        providers_attempted: providersAttempted,
        marketplace_host: marketplaceHost,
      },
    });
  }
  return listings;
}

function validatedListingUrl(value: string, expectedHost?: string) {
  try {
    const parsed = new URL(value);
    if (!["http:", "https:"].includes(parsed.protocol) || parsed.username || parsed.password) return null;
    const host = parsed.hostname.toLowerCase().replace(/^www\./, "").replace(/\.$/, "");
    if (expectedHost && host !== expectedHost && !host.endsWith(`.${expectedHost}`)) return null;
    parsed.protocol = "https:";
    parsed.hostname = host;
    parsed.hash = "";
    parsed.pathname = parsed.pathname.replace(/\/{2,}/g, "/").replace(/\/$/, "") || "/";
    for (const key of Array.from(parsed.searchParams.keys())) {
      if (/^(utm_.+|fbclid|gclid|msclkid|ref|referrer|source|campaign)$/i.test(key)) {
        parsed.searchParams.delete(key);
      }
    }
    parsed.searchParams.sort();
    return parsed.toString();
  } catch {
    return null;
  }
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
    const vehicleType = watchlist?.vehicle_type;
    const profile = localSearchProfile(resolveCountryCodes(watchlist ?? {})[0]);
    const vehicleTerm = vehicleType
      ? profile.vehicles[vehicleType] ?? (VEHICLE_TERMS[vehicleType] ?? VEHICLE_TERMS.other)[0]
      : ANY_VEHICLE_QUERY;
    const countryTerms = watchlist ? geographySearchTerms(watchlist) : [];
    const regionTerm = watchlist?.region_preset === "balkans" ? "Balkans"
      : watchlist?.region_preset === "schengen" ? "Schengen Europe"
      : watchlist?.region_preset ? "Europe"
      : countryTerms.slice(0, 8).join(" OR ");
    const location = [watchlist?.city, regionTerm || watchlist?.country].filter(Boolean).join(" ");
    const keywords = watchlist?.keywords.join(" ") ?? "";
    const baseParts = [
      location || "Europe",
      keywords,
      ...(watchlist ? watchlistQueryCriteria(watchlist, profile) : []),
      profile.sale,
    ].filter(Boolean);

    for (const term of [vehicleTerm]) {
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

function localSearchProfile(countryCode?: string) {
  const aliases: Record<string, string> = { AT: "DE", CH: "DE", BE: "NL", CY: "GR" };
  return LOCAL_SEARCH_PROFILES[aliases[countryCode ?? ""] ?? countryCode ?? ""] ?? ENGLISH_SEARCH_PROFILE;
}

function watchlistQueryCriteria(watchlist: ScannerWatchlist, profile: LocalSearchProfile) {
  const criteria: string[] = [];
  const fields = [
    watchlist.fuel_type,
    watchlist.transmission,
    watchlist.body_type,
    watchlist.drive_type,
    watchlist.seller_type,
    watchlist.condition,
  ];
  for (const value of fields) {
    if (!value) continue;
    const localized = profile.filters?.[value] ?? ENGLISH_SEARCH_PROFILE.filters?.[value] ?? value;
    criteria.push(queryToken(localized));
  }

  if (watchlist.emission_class) criteria.push(queryToken(watchlist.emission_class));
  if (watchlist.exterior_color) criteria.push(queryToken(watchlist.exterior_color));
  if (watchlist.min_price != null) criteria.push(`"from ${watchlist.min_price} ${watchlist.currency}"`);
  if (watchlist.max_price != null) criteria.push(`"up to ${watchlist.max_price} ${watchlist.currency}"`);
  if (watchlist.max_mileage_km != null) criteria.push(`"up to ${watchlist.max_mileage_km} km"`);

  const startYear = watchlist.min_year ?? watchlist.max_year;
  const endYear = watchlist.max_year ?? (watchlist.min_year ? new Date().getUTCFullYear() + 1 : null);
  if (startYear && endYear && endYear >= startYear && endYear - startYear <= 8) {
    criteria.push(`(${Array.from({ length: endYear - startYear + 1 }, (_, index) => startYear + index).join(" OR ")})`);
  }

  const required = (watchlist.must_have_keywords ?? [])
    .filter((keyword) => !keyword.startsWith("__vehigo_"))
    .slice(0, 5);
  if (required.length > 0) criteria.push(...required.map(queryToken));
  for (const excluded of (watchlist.excluded_keywords ?? []).slice(0, 5)) criteria.push(`-${queryToken(excluded)}`);
  return criteria;
}

function queryToken(value: string) {
  const clean = value.trim().replace(/"/g, "");
  return /\s/.test(clean) ? `"${clean}"` : clean;
}

function inferIndexedListingFields(text: string) {
  const years = [...text.matchAll(/\b(19[5-9]\d|20[0-3]\d)\b/g)].map((match) => Number(match[1]));
  // Never choose a year merely because it fits the watchlist. Search snippets
  // often contain copyright or registration years; biasing toward the desired
  // range turns unrelated pages into false positives. Preserve the first
  // observed year and let the matcher reject it when it is out of range.
  const year = years[0];
  const mileageMatch = text.match(/(\d{1,3}(?:[.\s,'’]\d{3})+|\d{3,7})\s*(?:km|kilomet(?:er|re|ri|ro|rów|rov)?)/i);
  const price = matchIndexedPrice(text);
  const powerMatch = text.match(/(\d{2,4})\s*(?:hp|ps|bhp|cv|pk|ch)\b/i);
  const engineCcMatch = text.match(/(\d{3,5})\s*(?:cc|cm3|cm³)\b/i);
  const engineLiterMatch = text.match(/\b(\d(?:[.,]\d))\s*(?:l|liter|litre|litri)\b/i);
  const doorMatch = text.match(/(\d)\s*(?:doors?|türen|tuerig|portes?|deuren|puertas?|porte|drzwi)\b/i);
  return {
    year,
    mileageKm: mileageMatch ? parseIndexedNumber(mileageMatch[1]) : undefined,
    price: price?.amount,
    currency: price?.currency,
    powerHp: powerMatch ? Number.parseInt(powerMatch[1], 10) : undefined,
    engineCc: engineCcMatch
      ? Number.parseInt(engineCcMatch[1], 10)
      : engineLiterMatch
        ? Math.round(Number.parseFloat(engineLiterMatch[1].replace(",", ".")) * 1000)
        : undefined,
    doorCount: doorMatch ? Number.parseInt(doorMatch[1], 10) : undefined,
  };
}

function matchIndexedPrice(text: string) {
  const formats: Array<{ currency: string; symbols: string }> = [
    { currency: "EUR", symbols: "€|EUR" },
    { currency: "GBP", symbols: "£|GBP" },
    { currency: "CHF", symbols: "CHF" },
    { currency: "PLN", symbols: "PLN|zł|zl" },
    { currency: "SEK", symbols: "SEK|kr" },
  ];
  for (const format of formats) {
    const before = text.match(new RegExp(`(?:${format.symbols})\\s*(\\d[\\d.\\s,'’]*(?:[.,]\\d{2})?)`, "i"));
    const after = text.match(new RegExp(`(\\d[\\d.\\s,'’]*(?:[.,]\\d{2})?)\\s*(?:${format.symbols})`, "i"));
    const raw = before?.[1] ?? after?.[1];
    if (!raw) continue;
    const amount = parseIndexedPrice(raw);
    if (amount !== undefined) return { amount, currency: format.currency };
  }
  return null;
}

function parseIndexedNumber(value: string) {
  const parsed = Number.parseInt(value.replace(/\D/g, ""), 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function parseIndexedPrice(value: string) {
  const withoutDecimal = value.trim().replace(/[.,]\d{2}\s*$/, "");
  return parseIndexedNumber(withoutDecimal);
}

function mappedHostValue(host: string, values: Record<string, string>) {
  const normalized = host.toLowerCase().replace(/^www\./, "");
  const key = Object.keys(values).find((candidate) => normalized === candidate || normalized.endsWith(`.${candidate}`));
  return key ? values[key] : undefined;
}

// Brave often indexes a marketplace's category/search-results page (e.g. an
// aggregator's "Toyota Corolla cars ▸ 66 offers, price from €1,800") rather
// than a single vehicle's detail page. These carry a plausible title/price
// but describe a whole inventory, not the specific vehicle a watchlist is
// looking for, so they must not be treated as a discoverable listing.
function isAggregateListingPage(title?: string, description?: string) {
  const text = `${title ?? ""} ${description ?? ""}`;
  return [
    /\b\d[\d.,]*\s*(?:offers?|ads?|listings?|results?|anuncios|annonces|angebote|advertenties|annunci|ilanlar)\b/i,
    /\bprice from\b/i,
    /\bab\s*€\s*\d/i,
    /\bsearch results\b/i,
    /▸/,
  ].some((pattern) => pattern.test(text));
}

function isLikelyVehicleListing(url: string, title?: string, description?: string) {
  const text = `${url} ${title ?? ""} ${description ?? ""}`.toLowerCase();
  if (text.includes("youtube.com") || text.includes("wikipedia.org")) return false;
  if (isAggregateListingPage(title, description)) return false;
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
  const normalizedText = normalizeSearchText(text);
  const normalizedExpected = normalizeSearchText(expected);
  return normalizedExpected.length > 0 && normalizedText.includes(normalizedExpected);
}

function normalizeSearchText(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("en-US")
    .replace(/ı/g, "i")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function inferVehicleType(text: string): MarketListingInput["vehicle_type"] | undefined {
  const lower = text.toLowerCase();
  if (["trailer", "semi trailer", "auflieger", "remorque", "dorse"].some((term) => lower.includes(term))) return "trailer";
  if (["excavator", "wheel loader", "construction machine", "baumaschine", "iş makinesi"].some((term) => lower.includes(term))) return "construction";
  if (["spare parts", "truck parts", "ersatzteile", "yedek parça"].some((term) => lower.includes(term))) return "spare_part";
  if (["bus", "coach", "reisebus", "otobüs"].some((term) => lower.includes(term))) return "bus";
  if (["van", "transporter", "camionnette", "bestelwagen", "hafif ticari"].some((term) => lower.includes(term))) return "van";
  if (["tractor unit", "articulated truck", "semi truck", "sattelzugmaschine", "tracteur routier", "trekker", "çekici"].some((term) => lower.includes(term))) return "tractor_unit";
  if (["truck", "lorry", "vrachtwagen", "camion", "lastwagen", "kamyon"].some((term) => lower.includes(term))) return "truck";
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

import type { BodyType, DriveType, FuelType, SellerType, TransmissionType, VehicleType } from "@/lib/supabase/types";
import type { RegionPreset } from "./geography";

export const SEARCH_PLAN_VERSION = 1 as const;
export const SEARCH_PLANNER_VERSION = "deterministic-multilingual-v2";

export type SearchPlanV1 = {
  version: typeof SEARCH_PLAN_VERSION;
  parserVersion: typeof SEARCH_PLANNER_VERSION;
  originalQuery: string;
  confidence: number;
  warnings: string[];
  filters: {
    brand?: string;
    model?: string;
    vehicle_type?: VehicleType;
    country_codes?: string[];
    region_preset?: RegionPreset;
    min_year?: number;
    max_year?: number;
    min_price?: number;
    max_price?: number;
    max_mileage_km?: number;
    fuel_type?: FuelType;
    transmission?: Exclude<TransmissionType, "other">;
    body_type?: Exclude<BodyType, "tractor_unit" | "rigid_truck" | "other">;
    drive_type?: Exclude<DriveType, "other">;
    seller_type?: Exclude<SellerType, "unknown">;
    search_mode?: "strict" | "discovery";
    keywords?: string[];
  };
};

const BRANDS = [
  "Mercedes-Benz", "Volkswagen", "Toyota", "Renault", "Peugeot", "Citroën", "Volvo",
  "Scania", "Iveco", "DAF", "MAN", "BMW", "Audi", "Ford", "Opel", "Fiat", "Tesla",
  "Hyundai", "Kia", "Skoda", "Nissan", "Porsche", "Land Rover", "Lexus", "Honda",
];

const COUNTRY_TERMS: Record<string, string[]> = {
  DE: ["almanya", "germany", "deutschland"], NL: ["hollanda", "netherlands", "nederland"],
  BE: ["belçika", "belgium", "belgie"], FR: ["fransa", "france"], IT: ["italya", "italy", "italia"],
  ES: ["ispanya", "spain", "espana"], AT: ["avusturya", "austria", "osterreich"],
  PL: ["polonya", "poland", "polska"], PT: ["portekiz", "portugal"], RO: ["romanya", "romania"],
  BG: ["bulgaristan", "bulgaria"], CZ: ["çekya", "cekya", "czechia"], SE: ["isveç", "isvec", "sweden"],
  NO: ["norveç", "norvec", "norway"], DK: ["danimarka", "denmark"], FI: ["finlandiya", "finland"],
  GR: ["yunanistan", "greece"], GB: ["birleşik krallık", "birlesik krallik", "united kingdom", "uk"],
  CH: ["isviçre", "isvicre", "switzerland", "schweiz"],
};

const VEHICLE_TERMS: Array<[VehicleType, string[]]> = [
  ["tractor_unit", ["çekici", "cekici", "tractor unit", "sattelzugmaschine", "tracteur routier", "trekker"]],
  ["truck", ["kamyon", "truck", "lorry", "lkw"]],
  ["van", ["van", "hafif ticari", "transporter", "bestelwagen"]],
  ["trailer", ["dorse", "trailer", "auflieger"]],
  ["construction", ["iş makinesi", "is makinesi", "excavator", "baumaschine"]],
  ["bus", ["otobüs", "otobus", "bus", "coach"]],
  ["car", ["otomobil", "binek", "car", "auto"]],
];

export function parseNaturalLanguageSearch(query: string): SearchPlanV1 {
  const originalQuery = query.trim().replace(/\s+/g, " ");
  if (originalQuery.length < 3) throw new Error("Arama tarifi en az 3 karakter olmalı.");
  if (originalQuery.length > 1000) throw new Error("Arama tarifi en fazla 1000 karakter olabilir.");

  const normalized = normalize(originalQuery);
  const filters: SearchPlanV1["filters"] = {};
  const warnings: string[] = [];
  const matched = new Set<string>();

  const brand = BRANDS.find((candidate) => includesPhrase(normalized, normalize(candidate)));
  if (brand) {
    filters.brand = brand;
    matched.add("brand");
    const afterBrand = normalized.split(normalize(brand))[1]?.trim().split(/\s+/).slice(0, 5) ?? [];
    const stopWords = new Set(["model", "otomobil", "araba", "car", "auto", "kamyon", "truck", "van", "cekici", "tractor", "sattelzugmaschine", "dizel", "diesel", "benzin", "gasoline", "petrol", "hybrid", "hibrit", "electric", "elektrik", "otomatik", "automatic", "manuel", "manual", "strict", "discovery", "kesif", "almanya", "hollanda", "germany", "netherlands", "manufactured", "manufacture", "made", "built", "uretim", "uretilmis", "in", "da", "de"]);
    const modelParts: string[] = [];
    for (const part of afterBrand) {
      if (stopWords.has(part) || /^\d{4}$/.test(part) || /^[0-9]+(?:k|bin)?$/.test(part)) break;
      modelParts.push(part);
      if (modelParts.length === 2) break;
    }
    if (modelParts.length > 0) filters.model = modelParts.join(" ");
  }

  for (const [vehicleType, terms] of VEHICLE_TERMS) {
    if (terms.some((term) => includesPhrase(normalized, normalize(term)))) {
      filters.vehicle_type = vehicleType;
      matched.add("vehicle_type");
      break;
    }
  }

  const countryCodes = Object.entries(COUNTRY_TERMS)
    .filter(([, terms]) => terms.some((term) => includesPhrase(normalized, normalize(term))))
    .map(([code]) => code);
  if (countryCodes.length > 0) {
    filters.country_codes = countryCodes;
    matched.add("geography");
  } else if (/\b(schengen|şengen|sengen)\b/.test(normalized)) {
    filters.region_preset = "schengen";
    matched.add("geography");
  } else if (/\b(eea|aea|avrupa ekonomik alani)\b/.test(normalized)) {
    filters.region_preset = "eea";
    matched.add("geography");
  } else if (/\b(balkan|balkans|balkanlar)\b/.test(normalized)) {
    filters.region_preset = "balkans";
    matched.add("geography");
  } else if (/\b(eu|ab|avrupa birligi)\b/.test(normalized)) {
    filters.region_preset = "eu";
    matched.add("geography");
  }

  const yearRange = normalized.match(/\b(19[5-9]\d|20\d{2})\s*(?:-|ile|to)\s*(19[5-9]\d|20\d{2})\b/);
  const yearAfter = normalized.match(/\b(19[5-9]\d|20\d{2})\s*(?:ve sonrasi|sonrasi|uzeri|after|or newer|ab)\b/);
  const yearBefore = normalized.match(/\b(19[5-9]\d|20\d{2})\s*(?:ve oncesi|oncesi|alti|before|or older|bis)\b/);
  if (yearRange) {
    filters.min_year = Number(yearRange[1]);
    filters.max_year = Number(yearRange[2]);
    matched.add("year");
  } else if (yearAfter) {
    filters.min_year = Number(yearAfter[1]);
    matched.add("year");
  } else if (yearBefore) {
    filters.max_year = Number(yearBefore[1]);
    matched.add("year");
  } else {
    const standaloneYear = normalized.match(/\b(19[5-9]\d|20\d{2})\b/);
    if (standaloneYear) {
      filters.min_year = Number(standaloneYear[1]);
      filters.max_year = Number(standaloneYear[1]);
      matched.add("year");
    }
  }

  const price = matchAmount(normalized, ["eur", "euro", "€"], ["altinda", "max", "under", "bis", "en fazla"]);
  if (price !== null) {
    filters.max_price = price;
    matched.add("price");
  }
  const mileage = matchAmount(normalized, ["km", "kilometre"], ["altinda", "max", "under", "bis", "en fazla"]);
  if (mileage !== null) {
    filters.max_mileage_km = mileage;
    matched.add("mileage");
  }

  assignTerm(normalized, filters, "fuel_type", {
    diesel: ["dizel", "diesel"], gasoline: ["benzin", "gasoline", "petrol"],
    electric: ["elektrik", "electric", "elektro"], hybrid: ["hibrit", "hybrid", "phev"],
    lpg: ["lpg", "autogas"], hydrogen: ["hidrojen", "hydrogen", "wasserstoff"],
  });
  assignTerm(normalized, filters, "transmission", {
    automatic: ["otomatik", "automatic", "automatik"], manual: ["manuel", "manual", "schaltgetriebe"],
    semi_automatic: ["yari otomatik", "semi automatic", "halbautomatik"],
  });
  assignTerm(normalized, filters, "body_type", {
    suv: ["suv"], sedan: ["sedan", "limousine"], station_wagon: ["kombi", "station wagon", "estate"],
    hatchback: ["hatchback"], coupe: ["coupe"], convertible: ["cabrio", "convertible"],
    pickup: ["pickup", "pick up"], van: ["van"],
  });
  assignTerm(normalized, filters, "drive_type", {
    awd: ["4x4", "awd", "allrad"], fwd: ["fwd", "onden cekis"], rwd: ["rwd", "arkadan itis", "heckantrieb"],
  });
  assignTerm(normalized, filters, "seller_type", {
    dealer: ["galeri", "bayi", "dealer", "handler"], private: ["bireysel", "sahibinden", "private", "privat"],
  });

  if (/\b(kesin|strict|yalniz dogrulanmis)\b/.test(normalized)) filters.search_mode = "strict";
  if (/\b(kesif|discovery|bilgisi eksik)\b/.test(normalized)) filters.search_mode = "discovery";

  if (!filters.brand && !filters.vehicle_type) warnings.push("Marka veya araç tipi kesin olarak anlaşılamadı.");
  if (!filters.country_codes && !filters.region_preset) warnings.push("Coğrafi kapsam belirtilmedi; tüm kaynaklar aranacak.");
  const confidence = Math.min(0.98, Math.round((0.35 + matched.size * 0.1 + Object.keys(filters).length * 0.03) * 100) / 100);

  return {
    version: SEARCH_PLAN_VERSION,
    parserVersion: SEARCH_PLANNER_VERSION,
    originalQuery,
    confidence,
    warnings,
    filters,
  };
}

export function isSearchPlanV1(value: unknown): value is SearchPlanV1 {
  if (!value || typeof value !== "object") return false;
  const plan = value as Partial<SearchPlanV1>;
  return plan.version === SEARCH_PLAN_VERSION
    && plan.parserVersion === SEARCH_PLANNER_VERSION
    && typeof plan.originalQuery === "string"
    && typeof plan.confidence === "number"
    && Array.isArray(plan.warnings)
    && Boolean(plan.filters && typeof plan.filters === "object");
}

function normalize(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("en-US")
    .replace(/ı/g, "i")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function includesPhrase(text: string, phrase: string) {
  return new RegExp(`(?:^|\\s)${escapeRegExp(phrase)}(?:$|\\s)`).test(text);
}

function matchAmount(text: string, units: string[], comparators: string[]) {
  const unit = units.map(escapeRegExp).join("|");
  const comparator = comparators.map(escapeRegExp).join("|");
  const patterns = [
    new RegExp(`(?:${comparator})\\s*([0-9]+(?:[.,][0-9]+)?)\\s*(bin|k)?\\s*(?:${unit})`),
    new RegExp(`([0-9]+(?:[.,][0-9]+)?)\\s*(bin|k)?\\s*(?:${unit})\\s*(?:${comparator})`),
    new RegExp(`([0-9]+(?:[.,][0-9]+)?)\\s*(bin|k)\\s*(?:${unit})`),
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (!match) continue;
    const value = Number.parseFloat(match[1].replace(",", "."));
    return Math.round(value * (match[2] ? 1000 : 1));
  }
  return null;
}

function assignTerm<K extends keyof SearchPlanV1["filters"]>(
  text: string,
  filters: SearchPlanV1["filters"],
  key: K,
  terms: Record<string, string[]>,
) {
  const matches = Object.entries(terms).flatMap(([value, candidates]) =>
    candidates.flatMap((candidate) => includesPhrase(text, normalize(candidate))
      ? [{ value, length: normalize(candidate).length }]
      : []),
  );
  const best = matches.sort((left, right) => right.length - left.length)[0];
  if (best) (filters as Record<string, unknown>)[key] = best.value;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

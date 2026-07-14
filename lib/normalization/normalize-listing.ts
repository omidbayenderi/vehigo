import {
  CANONICAL_LISTING_SCHEMA_VERSION,
  type BodyType,
  type CanonicalMarketListingInput,
  type DriveType,
  type FuelType,
  type MarketListingInput,
  type SellerType,
  type TransmissionType,
} from "@/lib/domain/listings";
import type { Json, VehicleCondition, VehicleType } from "@/lib/supabase/types";
import {
  BODY_TERMS,
  BRAND_ALIASES,
  CONDITION_TERMS,
  COUNTRY_ALIASES,
  DRIVE_TERMS,
  FUEL_TERMS,
  SELLER_TERMS,
  TRANSMISSION_TERMS,
  VEHICLE_TYPE_TERMS,
} from "./dictionaries";

const NORMALIZED_AT_FALLBACK = "1970-01-01T00:00:00.000Z";

export function normalizeMarketListing(
  input: MarketListingInput,
  now: Date = new Date(),
): CanonicalMarketListingInput {
  const warnings: string[] = [];
  const evidence: Record<string, Json> = {};
  const rawText = rawString(input.raw, ["description", "subject", "body"]);
  const searchText = normalizeText([input.title, input.description, rawText].filter(Boolean).join(" "));

  const brand = canonicalBrand(input.brand ?? inferBrand(searchText));
  recordEvidence(evidence, "brand", input.brand ? "structured" : brand ? "text" : null);

  const model = canonicalModel(input.model, brand);
  const sellerCountryCode = canonicalCountryCode(input.seller_country_code ?? input.seller_country);
  const fuelType = input.fuel_type ?? detectTerms<FuelType>(searchText, FUEL_TERMS);
  const transmission = input.transmission ?? detectTerms<TransmissionType>(searchText, TRANSMISSION_TERMS);
  const condition = input.condition ?? detectTerms<VehicleCondition>(searchText, CONDITION_TERMS);
  const sellerType = input.seller_type ?? detectTerms<SellerType>(searchText, SELLER_TERMS) ?? "unknown";
  const driveType = input.drive_type ?? detectTerms<DriveType>(searchText, DRIVE_TERMS);
  const bodyType = input.body_type ?? detectTerms<BodyType>(searchText, BODY_TERMS);
  const vehicleType = input.vehicle_type ?? detectTerms<VehicleType>(searchText, VEHICLE_TYPE_TERMS);
  const vin = normalizeVin(input.vin ?? rawString(input.raw, ["vin", "vehicleIdentificationNumber"]), warnings);
  const currency = normalizeCurrency(input.currency, warnings);
  const images = normalizeImages(input.images, warnings);

  if (!input.title) warnings.push("missing_title");
  if (!brand) warnings.push("missing_brand");
  if (!model) warnings.push("missing_model");
  if (!vehicleType) warnings.push("missing_vehicle_type");
  if (input.price === undefined) warnings.push("missing_price");
  if (!sellerCountryCode) warnings.push("missing_country_code");

  const normalized: MarketListingInput = {
    ...input,
    title: cleanOptional(input.title),
    description: cleanOptional(input.description ?? rawText),
    seller_name: cleanOptional(input.seller_name),
    seller_country: cleanOptional(input.seller_country),
    seller_country_code: sellerCountryCode,
    seller_city: cleanOptional(input.seller_city),
    seller_postal_code: cleanOptional(input.seller_postal_code),
    seller_type: sellerType,
    brand,
    model,
    variant: cleanOptional(input.variant),
    currency,
    vehicle_type: vehicleType,
    body_type: bodyType,
    fuel_type: fuelType,
    transmission,
    drive_type: driveType,
    emission_class: normalizeEmissionClass(input.emission_class ?? searchText),
    exterior_color: cleanOptional(input.exterior_color),
    vin,
    images,
    condition,
    raw: input.raw,
  };

  const confidence = calculateConfidence(normalized);
  const normalizedAt = Number.isNaN(now.getTime()) ? NORMALIZED_AT_FALLBACK : now.toISOString();
  return {
    ...normalized,
    canonical_schema_version: CANONICAL_LISTING_SCHEMA_VERSION,
    normalization_confidence: confidence,
    normalization_warnings: [...new Set(warnings)],
    canonical_fingerprint: createCanonicalFingerprint(normalized),
    normalized_at: normalizedAt,
    normalization_evidence: evidence,
  };
}

export function canonicalBrand(value?: string | null) {
  const clean = cleanOptional(value);
  if (!clean) return undefined;
  return BRAND_ALIASES[normalizeText(clean)] ?? clean;
}

export function canonicalCountryCode(value?: string | null) {
  const clean = cleanOptional(value);
  if (!clean) return undefined;
  if (/^[a-z]{2}$/i.test(clean)) return clean.toUpperCase();
  return COUNTRY_ALIASES[normalizeText(clean)];
}

export function createCanonicalFingerprint(input: MarketListingInput) {
  const vin = normalizeVin(input.vin, []);
  const identity = vin
    ? `vin|${vin}`
    : [
        canonicalBrand(input.brand) ?? "?",
        normalizeText(input.model ?? "?"),
        input.year ?? "?",
        input.mileage_km === undefined ? "?" : Math.round(input.mileage_km / 5_000),
        canonicalCountryCode(input.seller_country_code ?? input.seller_country) ?? "?",
        input.price === undefined ? "?" : Math.round(input.price / 500),
        normalizeCurrency(input.currency, []),
      ].join("|");

  return `v${CANONICAL_LISTING_SCHEMA_VERSION}_${stableHash(identity)}`;
}

function canonicalModel(value?: string | null, brand?: string) {
  const clean = cleanOptional(value);
  if (!clean) return undefined;
  const brandNames = brand
    ? [brand, ...Object.entries(BRAND_ALIASES)
        .filter(([, canonical]) => canonical === brand)
        .map(([alias]) => alias)]
        .sort((a, b) => b.length - a.length)
    : [];
  const brandPattern = brandNames
    .map((name) => name.split(/[-\s]+/).map(escapeRegExp).join("[-\\s]?"))
    .join("|");
  const withoutBrand = brandPattern
    ? clean.replace(new RegExp(`^(?:${brandPattern})\\s*`, "i"), "").trim()
    : clean;
  return withoutBrand.replace(/\s+/g, " ") || undefined;
}

function inferBrand(text: string) {
  const aliases = Object.keys(BRAND_ALIASES).sort((a, b) => b.length - a.length);
  return aliases.find((alias) => new RegExp(`(^|\\s)${escapeRegExp(alias)}(?=\\s|$)`, "i").test(text));
}

function normalizeCurrency(value: string | undefined, warnings: string[]) {
  const currency = (value ?? "EUR").trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency)) {
    warnings.push("invalid_currency");
    return "EUR";
  }
  return currency;
}

function normalizeVin(value: string | undefined, warnings: string[]) {
  const vin = value?.replace(/[^a-z0-9]/gi, "").toUpperCase();
  if (!vin) return undefined;
  if (!/^[A-HJ-NPR-Z0-9]{17}$/.test(vin)) {
    warnings.push("invalid_vin");
    return undefined;
  }
  return vin;
}

function normalizeImages(images: MarketListingInput["images"], warnings: string[]) {
  if (!images) return undefined;
  const seen = new Set<string>();
  const normalized = images.flatMap((image, index) => {
    try {
      const url = new URL(image.url);
      if (!/^https?:$/.test(url.protocol)) {
        warnings.push("invalid_image_url");
        return [];
      }
      if (seen.has(url.href)) return [];
      seen.add(url.href);
      return [{ url: url.href, position: image.position ?? index }];
    } catch {
      warnings.push("invalid_image_url");
      return [];
    }
  });
  return normalized.length > 0 ? normalized : undefined;
}

function normalizeEmissionClass(value?: string) {
  const match = value?.match(/euro\s*([1-6])\b/i);
  return match ? `Euro ${match[1]}` : cleanOptional(value && value.length <= 16 ? value : undefined);
}

function calculateConfidence(input: MarketListingInput) {
  const weighted: Array<[unknown, number]> = [
    [input.title, 1],
    [input.brand, 2],
    [input.model, 2],
    [input.year, 1],
    [input.price, 2],
    [input.mileage_km, 1],
    [input.vehicle_type, 1],
    [input.seller_country_code, 1],
    [input.vin, 2],
  ];
  const total = weighted.reduce((sum, [, weight]) => sum + weight, 0);
  const present = weighted.reduce((sum, [value, weight]) => sum + (value !== undefined && value !== null && value !== "" ? weight : 0), 0);
  return Math.round((present / total) * 100) / 100;
}

function detectTerms<T extends string>(text: string, terms: Partial<Record<T, string[]>>) {
  for (const [value, candidates] of Object.entries(terms) as Array<[T, string[]]>) {
    if (candidates.some((term) => text.includes(normalizeText(term)))) return value;
  }
  return undefined;
}

function rawString(raw: Record<string, unknown> | undefined, keys: string[]) {
  for (const key of keys) {
    const value = raw?.[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return undefined;
}

function cleanOptional(value?: string | null) {
  const clean = value?.trim().replace(/\s+/g, " ");
  return clean || undefined;
}

function normalizeText(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("en-US")
    .replace(/[_/|,;:()\[\]-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function stableHash(value: string) {
  let first = 0x811c9dc5;
  let second = 0x9e3779b9;
  for (let index = 0; index < value.length; index++) {
    const code = value.charCodeAt(index);
    first = Math.imul(first ^ code, 0x01000193);
    second = Math.imul(second ^ code, 0x85ebca6b);
  }
  return `${(first >>> 0).toString(16).padStart(8, "0")}${(second >>> 0).toString(16).padStart(8, "0")}`;
}

function recordEvidence(target: Record<string, Json>, field: string, source: string | null) {
  if (source) target[field] = source;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

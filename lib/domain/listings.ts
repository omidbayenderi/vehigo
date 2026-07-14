import type { Json, VehicleCondition, VehicleType } from "@/lib/supabase/types";

export const CANONICAL_LISTING_SCHEMA_VERSION = 1 as const;

export type FuelType =
  | "gasoline"
  | "diesel"
  | "electric"
  | "hybrid"
  | "lpg"
  | "hydrogen"
  | "other";

export type TransmissionType = "automatic" | "manual" | "semi_automatic" | "other";
export type SellerType = "private" | "dealer" | "unknown";
export type DriveType = "fwd" | "rwd" | "awd" | "other";
export type BodyType =
  | "sedan"
  | "suv"
  | "station_wagon"
  | "hatchback"
  | "coupe"
  | "convertible"
  | "pickup"
  | "van"
  | "tractor_unit"
  | "rigid_truck"
  | "other";

export type ListingImageInput = {
  url: string;
  position?: number;
};

/**
 * Boundary contract accepted from every discovery channel. Fields stay optional
 * because marketplaces expose different data; normalization records uncertainty
 * instead of inventing values.
 */
export type MarketListingInput = {
  source_key: string;
  source_listing_id?: string;
  listing_url: string;
  title?: string;
  description?: string;
  seller_name?: string;
  seller_country?: string;
  seller_country_code?: string;
  seller_city?: string;
  seller_postal_code?: string;
  seller_type?: SellerType;
  latitude?: number;
  longitude?: number;
  brand?: string;
  model?: string;
  variant?: string;
  year?: number;
  first_registration_date?: string;
  mileage_km?: number;
  price?: number;
  currency?: string;
  vat_deductible?: boolean;
  vehicle_type?: VehicleType;
  body_type?: BodyType;
  fuel_type?: FuelType;
  transmission?: TransmissionType;
  drive_type?: DriveType;
  power_hp?: number;
  engine_cc?: number;
  emission_class?: string;
  exterior_color?: string;
  vin?: string;
  seat_count?: number;
  door_count?: number;
  condition?: VehicleCondition;
  images?: ListingImageInput[];
  published_at?: string;
  raw?: Record<string, unknown>;
};

export type NormalizationMetadata = {
  schemaVersion: typeof CANONICAL_LISTING_SCHEMA_VERSION;
  confidence: number;
  warnings: string[];
  fingerprint: string;
  normalizedAt: string;
  evidence: Json;
};

export type CanonicalMarketListingInput = MarketListingInput & {
  canonical_schema_version: typeof CANONICAL_LISTING_SCHEMA_VERSION;
  normalization_confidence: number;
  normalization_warnings: string[];
  canonical_fingerprint: string;
  normalized_at: string;
  normalization_evidence: Json;
};

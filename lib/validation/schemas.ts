import { z } from "zod";

const publicHttpUrlSchema = z.string().url().refine((value) => {
  try {
    const url = new URL(value);
    return (url.protocol === "http:" || url.protocol === "https:") && !url.username && !url.password;
  } catch {
    return false;
  }
}, "Yalnızca kimlik bilgisi içermeyen HTTP(S) URL kabul edilir");

export const loginSchema = z.object({
  email: z.string().email("Geçerli bir e-posta girin"),
  password: z.string().min(6, "Şifre en az 6 karakter olmalı"),
});

export const vehicleSchema = z.object({
  source_site: z.string().optional(),
  listing_url: publicHttpUrlSchema.optional().or(z.literal("")),
  seller_name: z.string().optional(),
  seller_country: z.string().optional(),
  brand: z.string().min(1, "Marka zorunlu"),
  model: z.string().min(1, "Model zorunlu"),
  year: z.coerce.number().int().min(1950).max(new Date().getFullYear() + 1).optional(),
  mileage_km: z.coerce.number().int().min(0).optional(),
  price: z.coerce.number().min(0, "Fiyat zorunlu"),
  currency: z.string().default("EUR"),
  vat_status: z.enum(["vat_included", "vat_free", "margin_scheme", "unknown"]).optional(),
  vehicle_type: z.enum(["car", "van", "truck", "tractor_unit", "trailer", "construction", "spare_part", "bus", "other"]),
  euro_class: z.string().optional(),
  condition: z.enum(["new", "used_excellent", "used_good", "used_fair", "damaged"]).optional(),
  availability_status: z.enum(["available", "reserved", "sold", "expired"]).default("available"),
  notes: z.string().optional(),
});

export const leadSchema = z.object({
  company_or_name: z.string().min(1, "İsim/şirket zorunlu"),
  city: z.string().optional(),
  phone_whatsapp: z.string().optional(),
  telegram_handle: z.string().optional(),
  instagram_handle: z.string().optional(),
  business_type: z.string().optional(),
  desired_vehicle_type: z.string().optional(),
  budget_min: z.coerce.number().min(0).optional(),
  budget_max: z.coerce.number().min(0).optional(),
  budget_currency: z.string().default("EUR"),
  source: z
    .enum(["instagram", "telegram", "divar", "sheypoor", "google_maps", "referral", "manual"])
    .optional(),
  seriousness_score: z.coerce.number().int().min(0).max(100).default(0),
  status: z
    .enum([
      "new",
      "contacted",
      "interested",
      "vehicle_proposed",
      "offer_sent",
      "deposit_requested",
      "in_progress",
      "closed_won",
      "closed_lost",
    ])
    .default("new"),
  notes: z.string().optional(),
});

export const offerCostSchema = z.object({
  lead_id: z.string().uuid(),
  vehicle_id: z.string().uuid(),
  base_vehicle_price: z.coerce.number().min(0),
  export_company_fee: z.coerce.number().min(0).default(0),
  transport_cost: z.coerce.number().min(0).default(0),
  insurance_cost: z.coerce.number().min(0).default(0),
  iran_customs_estimate: z.coerce.number().min(0).default(0),
  internal_service_fee: z.coerce.number().min(0).default(0),
  commission_type: z.enum(["fixed", "percentage"]).default("fixed"),
  commission_value: z.coerce.number().min(0).default(0),
  currency: z.string().default("EUR"),
  validity_date: z.string().optional(),
  delivery_terms: z.string().optional(),
  payment_steps: z.string().optional(),
  status: z.enum(["draft", "sent", "accepted", "rejected", "expired"]).optional(),
});

export const offerOutcomeSchema = z.object({
  closed_outcome: z.enum(["won", "lost"]),
  actual_total_cost: z.coerce.number().min(0).optional(),
  actual_revenue: z.coerce.number().min(0).optional(),
  closed_notes: z.string().optional(),
});

export const complianceChecklistSchema = z.object({
  offer_id: z.string().uuid(),
  export_legality_checked: z.boolean().default(false),
  sanctioned_entity_check_done: z.boolean().default(false),
  vehicle_category_allowed: z.boolean().default(false),
  documents_checked: z.boolean().default(false),
  customs_partner_confirmed: z.boolean().default(false),
  payment_method_agreed: z.boolean().default(false),
  buyer_identity_verified: z.boolean().default(false),
});

export const listingPurchaseChecklistSchema = z.object({
  listing_id: z.string().uuid(),
  vin: z.string().optional(),
  vin_verified: z.boolean().default(false),
  documents_checked: z.boolean().default(false),
  damage_inspected: z.boolean().default(false),
  damage_notes: z.string().optional(),
  seller_trustworthy: z.boolean().default(false),
  seller_notes: z.string().optional(),
  payment_risk_acceptable: z.boolean().default(false),
  payment_notes: z.string().optional(),
  estimated_transport_cost: z.coerce.number().min(0).default(0),
  estimated_insurance_cost: z.coerce.number().min(0).default(0),
  estimated_customs_cost: z.coerce.number().min(0).default(0),
  estimated_prep_cost: z.coerce.number().min(0).default(0),
});

const currencyCodeSchema = z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/, "Para birimi üç harfli ISO kodu olmalı");
const countryCodeSchema = z.string().trim().toUpperCase().regex(/^[A-Z]{2}$/, "Ülke iki harfli ISO kodu olmalı");

export const exportManualCostSchema = z.object({
  code: z.string().trim().min(1).max(80).regex(/^[a-z0-9_\-]+$/i),
  label: z.string().trim().min(1).max(160),
  category: z.enum(["tax", "customs", "logistics", "insurance", "service", "compliance", "other"]),
  amount: z.coerce.number().min(0).max(1_000_000_000),
  currency: currencyCodeSchema,
  evidence: z.string().trim().max(2000).optional(),
});

export const exportScenarioSchema = z.object({
  name: z.string().trim().min(2, "Senaryo adı zorunlu").max(160),
  vehicle_id: z.string().uuid().optional(),
  market_listing_id: z.string().uuid().optional(),
  offer_id: z.string().uuid().optional(),
  route_id: z.string().uuid().optional(),
  rule_set_id: z.string().uuid().optional(),
  origin_country_code: countryCodeSchema,
  destination_country_code: countryCodeSchema,
  transport_mode: z.enum(["road", "rail", "sea", "air", "multimodal"]),
  vehicle_category: z.string().trim().min(1).max(80),
  buyer_profile: z.string().trim().min(1).max(80),
  calculation_currency: currencyCodeSchema.default("EUR"),
  vehicle_price: z.coerce.number().min(0).max(1_000_000_000),
  vehicle_currency: currencyCodeSchema,
  manual_costs: z.array(exportManualCostSchema).max(50).default([]),
  assumptions: z.record(z.string(), z.unknown()).default({}),
}).refine((value) => value.origin_country_code !== value.destination_country_code, { message: "Çıkış ve hedef ülke farklı olmalı", path: ["destination_country_code"] });

export const exchangeRateSnapshotSchema = z.object({
  base_currency: currencyCodeSchema,
  quote_currency: currencyCodeSchema,
  rate: z.coerce.number().positive().max(1_000_000_000),
  provider: z.string().trim().min(1).max(120),
  source_reference: z.string().trim().url().max(2000).optional().or(z.literal("")),
  observed_at: z.string().datetime({ offset: true }),
  expires_at: z.string().datetime({ offset: true }).optional(),
}).refine((value) => value.base_currency !== value.quote_currency, { message: "Kur çifti farklı para birimlerinden oluşmalı", path: ["quote_currency"] });

export const messageDraftSchema = z.object({
  lead_id: z.string().uuid(),
  offer_id: z.string().uuid().optional(),
  channel: z.enum(["whatsapp", "telegram", "instagram"]),
  draft_text: z.string().min(1, "Mesaj metni boş olamaz"),
});

const commaList = z.preprocess((value) => {
  if (Array.isArray(value)) {
    return value.flatMap((item) => String(item).split(",")).map((item) => item.trim()).filter(Boolean);
  }
  if (typeof value !== "string") return value;
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}, z.array(z.string()).default([]));

export const telegramSettingsSchema = z.object({
  telegram_username: z
    .string()
    .trim()
    .transform((value) => value.replace(/^@/, ""))
    .pipe(z.string().min(3, "Telegram kullanıcı adı en az 3 karakter olmalı"))
    .optional(),
});

export const watchlistSchema = z.object({
  name: z.string().min(1, "Alarm adı zorunlu"),
  active: z.coerce.boolean().default(true),
  source_keys: commaList,
  country: z.string().optional(),
  country_codes: commaList.transform((codes) => [...new Set(codes.map((code) => code.toUpperCase()))]),
  region_preset: z.enum(["eu", "eea", "schengen", "balkans"]).optional(),
  city: z.string().optional(),
  center_latitude: z.coerce.number().min(-90).max(90).optional(),
  center_longitude: z.coerce.number().min(-180).max(180).optional(),
  radius_km: z.coerce.number().int().min(1).max(2000).optional(),
  search_mode: z.enum(["strict", "discovery"]).default("strict"),
  freshness_hours: z.coerce.number().int().min(1).max(8760).default(168),
  sort_by: z.enum(["relevance", "newest", "price", "mileage", "year"]).default("relevance"),
  sort_direction: z.enum(["asc", "desc"]).default("desc"),
  page_size: z.coerce.number().int().min(10).max(100).default(25),
  natural_language_query: z.string().trim().min(3).max(1000).optional(),
  original_natural_language_query: z.string().trim().min(3).max(1000).optional(),
  confirmed_search_plan: z.string().max(12_000).optional(),
  brand: z.string().optional(),
  model: z.string().optional(),
  vehicle_type: z.enum(["car", "van", "truck", "tractor_unit", "trailer", "construction", "spare_part", "bus", "other"]).optional(),
  min_year: z.coerce.number().int().min(1950).optional(),
  max_year: z.coerce.number().int().min(1950).optional(),
  max_mileage_km: z.coerce.number().int().min(0).optional(),
  min_price: z.coerce.number().min(0).optional(),
  max_price: z.coerce.number().min(0).optional(),
  target_price: z.coerce.number().min(0).optional(),
  currency: z.string().default("EUR"),
  keywords: commaList,
  must_have_keywords: commaList,
  excluded_keywords: commaList,
  seat_count: z.coerce.number().int().min(1).max(100).optional(),
  condition: z.enum(["new", "used_excellent", "used_good", "used_fair", "damaged"]).optional(),
  fuel_type: z.enum(["gasoline", "diesel", "electric", "hybrid", "lpg", "hydrogen", "other"]).optional(),
  transmission: z.enum(["automatic", "manual", "semi_automatic"]).optional(),
  body_type: z.enum(["sedan", "suv", "station_wagon", "hatchback", "coupe", "convertible", "pickup", "van"]).optional(),
  drive_type: z.enum(["fwd", "rwd", "awd"]).optional(),
  seller_type: z.enum(["private", "dealer"]).optional(),
  min_power_hp: z.coerce.number().int().min(1).max(3000).optional(),
  max_power_hp: z.coerce.number().int().min(1).max(3000).optional(),
  min_engine_cc: z.coerce.number().int().min(50).max(30000).optional(),
  max_engine_cc: z.coerce.number().int().min(50).max(30000).optional(),
  min_doors: z.coerce.number().int().min(1).max(10).optional(),
  max_doors: z.coerce.number().int().min(1).max(10).optional(),
  emission_class: z.string().optional(),
  exterior_color: z.string().optional(),
  destination_country_code: z.preprocess(
    (value) => typeof value === "string" && value.trim() === "" ? undefined : value,
    z.string().trim().transform((value) => value.toUpperCase()).pipe(z.string().regex(/^[A-Z]{2}$/, "Hedef ülke iki harfli ISO kodu olmalı")).optional(),
  ),
  estimated_fixed_costs: z.coerce.number().min(0).default(0),
  monthly_holding_cost: z.coerce.number().min(0).default(0),
  cost_reserve_percent: z.coerce.number().min(0).max(100).default(10),
  conservative_sale_discount_percent: z.coerce.number().min(0).max(50).default(5),
  min_net_profit: z.coerce.number().min(0).default(3000),
  min_net_margin_percent: z.coerce.number().min(0).max(100).default(12),
  max_inventory_days: z.coerce.number().int().min(1).max(730).default(45),
  instant_alert_score: z.coerce.number().int().min(50).max(100).default(85),
});

export const searchPlanRequestSchema = z.object({
  query: z.string().trim().min(3, "Arama tarifi en az 3 karakter olmalı").max(1000),
}).strict();

export const searchListingsRequestSchema = z.object({
  watchlistId: z.string().uuid(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(10).max(100).optional(),
  sortBy: z.enum(["relevance", "newest", "price", "mileage", "year"]).optional(),
  sortDirection: z.enum(["asc", "desc"]).optional(),
});

export const marketListingInputSchema = z.object({
  source_key: z.string().min(1),
  source_listing_id: z.string().min(1).optional(),
  listing_url: publicHttpUrlSchema,
  title: z.string().optional(),
  description: z.string().optional(),
  seller_name: z.string().optional(),
  seller_country: z.string().optional(),
  seller_country_code: z.string().length(2).optional(),
  seller_city: z.string().optional(),
  seller_postal_code: z.string().optional(),
  seller_type: z.enum(["private", "dealer", "unknown"]).optional(),
  latitude: z.coerce.number().min(-90).max(90).optional(),
  longitude: z.coerce.number().min(-180).max(180).optional(),
  brand: z.string().optional(),
  model: z.string().optional(),
  variant: z.string().optional(),
  year: z.coerce.number().int().min(1950).optional(),
  first_registration_date: z.string().date().optional(),
  mileage_km: z.coerce.number().int().min(0).optional(),
  price: z.coerce.number().min(0).optional(),
  currency: z.string().default("EUR"),
  vat_deductible: z.boolean().optional(),
  vehicle_type: z.enum(["car", "van", "truck", "tractor_unit", "trailer", "construction", "spare_part", "bus", "other"]).optional(),
  body_type: z.enum(["sedan", "suv", "station_wagon", "hatchback", "coupe", "convertible", "pickup", "van", "tractor_unit", "rigid_truck", "other"]).optional(),
  fuel_type: z.enum(["gasoline", "diesel", "electric", "hybrid", "lpg", "hydrogen", "other"]).optional(),
  transmission: z.enum(["automatic", "manual", "semi_automatic", "other"]).optional(),
  drive_type: z.enum(["fwd", "rwd", "awd", "other"]).optional(),
  power_hp: z.coerce.number().int().min(1).max(5000).optional(),
  engine_cc: z.coerce.number().int().min(50).max(100000).optional(),
  emission_class: z.string().optional(),
  exterior_color: z.string().optional(),
  vin: z.string().optional(),
  seat_count: z.coerce.number().int().min(1).max(100).optional(),
  door_count: z.coerce.number().int().min(1).max(20).optional(),
  condition: z.enum(["new", "used_excellent", "used_good", "used_fair", "damaged"]).optional(),
  images: z.array(z.object({ url: publicHttpUrlSchema, position: z.number().int().min(0).optional() })).max(100).optional(),
  published_at: z.string().datetime({ offset: true }).optional(),
  raw: z.record(z.string(), z.unknown()).optional(),
});

export const canonicalMarketListingInputSchema = marketListingInputSchema.extend({
  canonical_schema_version: z.literal(1),
  normalization_confidence: z.number().min(0).max(1),
  normalization_warnings: z.array(z.string()),
  canonical_fingerprint: z.string().min(1),
  normalized_at: z.string().datetime({ offset: true }),
  normalization_evidence: z.unknown(),
});

export const listingDecisionSchema = z.object({
  decision_status: z.enum(["new", "shortlisted", "rejected", "actioned"]),
  decision_reason: z
    .enum([
      "good_price",
      "right_vehicle",
      "trusted_seller",
      "too_expensive",
      "wrong_vehicle",
      "bad_condition",
      "sold",
      "duplicate",
      "other",
    ])
    .optional(),
});

import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email("Geçerli bir e-posta girin"),
  password: z.string().min(6, "Şifre en az 6 karakter olmalı"),
});

export const vehicleSchema = z.object({
  source_site: z.string().optional(),
  listing_url: z.string().url().optional().or(z.literal("")),
  seller_name: z.string().optional(),
  seller_country: z.string().optional(),
  brand: z.string().min(1, "Marka zorunlu"),
  model: z.string().min(1, "Model zorunlu"),
  year: z.coerce.number().int().min(1950).max(new Date().getFullYear() + 1).optional(),
  mileage_km: z.coerce.number().int().min(0).optional(),
  price: z.coerce.number().min(0, "Fiyat zorunlu"),
  currency: z.string().default("EUR"),
  vat_status: z.enum(["vat_included", "vat_free", "margin_scheme", "unknown"]).optional(),
  vehicle_type: z.enum(["car", "van", "truck", "trailer", "construction", "spare_part", "bus", "other"]),
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
  city: z.string().optional(),
  brand: z.string().optional(),
  model: z.string().optional(),
  vehicle_type: z.enum(["car", "van", "truck", "trailer", "construction", "spare_part", "bus", "other"]).optional(),
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
});

export const marketListingInputSchema = z.object({
  source_key: z.string().min(1),
  source_listing_id: z.string().min(1).optional(),
  listing_url: z.string().url(),
  title: z.string().optional(),
  seller_name: z.string().optional(),
  seller_country: z.string().optional(),
  seller_city: z.string().optional(),
  brand: z.string().optional(),
  model: z.string().optional(),
  year: z.coerce.number().int().min(1950).optional(),
  mileage_km: z.coerce.number().int().min(0).optional(),
  price: z.coerce.number().min(0).optional(),
  currency: z.string().default("EUR"),
  vehicle_type: z.enum(["car", "van", "truck", "trailer", "construction", "spare_part", "bus", "other"]).optional(),
  raw: z.record(z.string(), z.unknown()).optional(),
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

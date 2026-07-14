import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { analyzeComparables, MARKET_INTELLIGENCE_VERSION, type ComparableListing } from "@/lib/intelligence/market-intelligence";
import { analyzeRisk } from "@/lib/intelligence/risk-engine";
import type { Database, Json } from "@/lib/supabase/types";

type Client = SupabaseClient<Database>;
type Listing = Database["public"]["Tables"]["market_listings"]["Row"];
export type IntelligenceSnapshot = Database["public"]["Tables"]["market_intelligence_snapshots"]["Row"];

export async function analyzeMarketListing(supabase: Client, listingId: string): Promise<IntelligenceSnapshot> {
  const { data: listing, error: listingError } = await supabase.from("market_listings").select("*").eq("id", listingId).single();
  if (listingError) throw new Error(listingError.message);
  if (!listing.brand || !listing.model || !listing.price) throw new Error("Piyasa analizi için marka, model ve fiyat gereklidir.");

  let comparableQuery = supabase
    .from("market_listings")
    .select("*")
    .eq("status", "active")
    .eq("currency", listing.currency)
    .ilike("brand", listing.brand)
    .ilike("model", listing.model)
    .neq("id", listing.id)
    .not("price", "is", null)
    .order("last_seen_at", { ascending: false })
    .limit(120);
  if (listing.year) comparableQuery = comparableQuery.gte("year", listing.year - 5).lte("year", listing.year + 5);

  const [{ data: candidates, error: candidatesError }, { data: history, error: historyError }, sellerCountResult] = await Promise.all([
    comparableQuery,
    supabase.from("market_listing_price_history").select("price,currency,recorded_at").eq("listing_id", listing.id).order("recorded_at", { ascending: true }).limit(500),
    listing.seller_name
      ? supabase.from("market_listings").select("id", { count: "exact", head: true }).eq("seller_name", listing.seller_name).eq("status", "active")
      : Promise.resolve({ count: 0, error: null }),
  ]);
  if (candidatesError) throw new Error(candidatesError.message);
  if (historyError) throw new Error(historyError.message);
  if (sellerCountResult.error) throw new Error(sellerCountResult.error.message);

  const subject = toComparable(listing);
  const comparison = analyzeComparables(subject, (candidates ?? []).map(toComparable));
  const priceHistory = (history ?? []).map((point) => ({ price: point.price, currency: point.currency, recordedAt: point.recorded_at }));
  if (!priceHistory.some((point) => point.price === listing.price)) priceHistory.push({ price: listing.price, currency: listing.currency, recordedAt: listing.last_seen_at });
  const risk = analyzeRisk({
    listing: {
      price: listing.price,
      currency: listing.currency,
      firstSeenAt: listing.first_seen_at,
      title: listing.title,
      description: listing.description,
      sellerName: listing.seller_name,
      sellerType: listing.seller_type,
      vin: listing.vin,
      year: listing.year,
      mileageKm: listing.mileage_km,
      normalizationConfidence: listing.normalization_confidence,
      normalizationWarnings: listing.normalization_warnings,
      condition: listing.condition,
    },
    comparison,
    priceHistory,
    sellerInventoryCount: sellerCountResult.count ?? 0,
  });

  const evidence = {
    version: MARKET_INTELLIGENCE_VERSION,
    subject: { id: listing.id, price: listing.price, currency: listing.currency, updatedAt: listing.updated_at },
    selected: comparison.selected.map((item) => ({ id: item.id, sourceKey: item.sourceKey, price: item.price, similarity: item.similarity })),
    excluded: comparison.excluded,
    priceHistoryObservations: priceHistory.length,
    safeguards: ["same_currency", "canonical_brand_model", "duplicate_cluster_deduplication", "sample_quality_gate"],
  };
  const evidenceHash = createHash("sha256").update(stableStringify(evidence)).digest("hex");
  const insert = {
    listing_id: listing.id,
    analysis_version: MARKET_INTELLIGENCE_VERSION,
    evidence_hash: evidenceHash,
    sample_quality: comparison.sampleQuality,
    claim_eligible: comparison.claimEligible,
    comparable_count: comparison.comparableCount,
    source_count: comparison.sourceCount,
    comparable_listing_ids: comparison.selected.map((item) => item.id),
    distribution: (comparison.distribution ?? {}) as Json,
    underpricing_percent: comparison.underpricingPercent,
    confidence: comparison.confidence,
    risk_score: risk.score,
    risk_level: risk.level,
    risk_signals: risk.signals as unknown as Json,
    seller_signals: risk.sellerSignals as unknown as Json,
    price_trend: risk.priceTrend as unknown as Json,
    evidence: evidence as unknown as Json,
  } satisfies Database["public"]["Tables"]["market_intelligence_snapshots"]["Insert"];

  const { data: created, error: createError } = await supabase
    .from("market_intelligence_snapshots")
    .upsert(insert, { onConflict: "listing_id,analysis_version,evidence_hash", ignoreDuplicates: true })
    .select("*")
    .maybeSingle();
  if (createError) throw new Error(createError.message);
  if (created) return created;
  const { data: existing, error: existingError } = await supabase.from("market_intelligence_snapshots").select("*").eq("listing_id", listing.id).eq("analysis_version", MARKET_INTELLIGENCE_VERSION).eq("evidence_hash", evidenceHash).single();
  if (existingError) throw new Error(existingError.message);
  return existing;
}

export async function listLatestIntelligenceByListingIds(supabase: Client, listingIds: string[]) {
  if (listingIds.length === 0) return new Map<string, IntelligenceSnapshot>();
  const { data, error } = await supabase.from("market_intelligence_snapshots").select("*").in("listing_id", listingIds).order("calculated_at", { ascending: false });
  if (error) throw new Error(error.message);
  const latest = new Map<string, IntelligenceSnapshot>();
  for (const snapshot of data ?? []) if (!latest.has(snapshot.listing_id)) latest.set(snapshot.listing_id, snapshot);
  return latest;
}

export async function getLatestListingIntelligence(supabase: Client, listingId: string) {
  const { data, error } = await supabase.from("market_intelligence_snapshots").select("*").eq("listing_id", listingId).order("calculated_at", { ascending: false }).limit(1).maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

function toComparable(listing: Listing): ComparableListing {
  return {
    id: listing.id,
    sourceKey: listing.source_key,
    duplicateClusterId: listing.duplicate_cluster_id,
    canonicalFingerprint: listing.canonical_fingerprint,
    price: listing.price,
    currency: listing.currency,
    brand: listing.brand,
    model: listing.model,
    variant: listing.variant,
    year: listing.year,
    mileageKm: listing.mileage_km,
    countryCode: listing.seller_country_code,
    vehicleType: listing.vehicle_type,
    bodyType: listing.body_type,
    fuelType: listing.fuel_type,
    transmission: listing.transmission,
    status: listing.status,
  };
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, child]) => `${JSON.stringify(key)}:${stableStringify(child)}`).join(",")}}`;
  return JSON.stringify(value);
}

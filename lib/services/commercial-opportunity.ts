import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/lib/supabase/types";
import { analyzeMarketListing } from "@/lib/services/market-intelligence";
import { sendTelegramMessage } from "@/lib/services/notifications";

type Client = SupabaseClient<Database>;
type Listing = Database["public"]["Tables"]["market_listings"]["Row"];
type Watchlist = Database["public"]["Tables"]["watchlists"]["Row"];

export const COMMERCIAL_EVALUATION_VERSION = "commercial-opportunity-v1";

export type CommercialProfile = {
  estimatedFixedCosts: number;
  monthlyHoldingCost: number;
  costReservePercent: number;
  conservativeSaleDiscountPercent: number;
  minNetProfit: number;
  minNetMarginPercent: number;
  maxInventoryDays: number;
};

export type CommercialOpportunityAssessment = {
  status: "approved" | "rejected" | "insufficient_data" | "error";
  approved: boolean;
  purchasePrice: number;
  medianComparablePrice: number | null;
  expectedSalePrice: number | null;
  estimatedTotalCost: number;
  estimatedNetProfit: number | null;
  estimatedNetMarginPercent: number | null;
  comparableCount: number;
  sourceCount: number;
  confidence: number;
  reason: string;
  evidence: Json;
};

export function calculateCommercialOpportunity(input: {
  purchasePrice: number;
  medianComparablePrice: number | null;
  comparableCount: number;
  sourceCount: number;
  confidence: number;
  riskLevel: string;
  profile: CommercialProfile;
}): CommercialOpportunityAssessment {
  const reserve = input.purchasePrice * input.profile.costReservePercent / 100;
  const holdingCost = input.profile.monthlyHoldingCost * input.profile.maxInventoryDays / 30;
  const totalCost = round(input.purchasePrice + input.profile.estimatedFixedCosts + reserve + holdingCost);
  const common = {
    purchasePrice: round(input.purchasePrice),
    medianComparablePrice: input.medianComparablePrice === null ? null : round(input.medianComparablePrice),
    estimatedTotalCost: totalCost,
    comparableCount: input.comparableCount,
    sourceCount: input.sourceCount,
    confidence: input.confidence,
  };

  if (input.medianComparablePrice === null || input.comparableCount < 6 || input.sourceCount < 2) {
    return {
      ...common,
      status: "insufficient_data",
      approved: false,
      expectedSalePrice: null,
      estimatedNetProfit: null,
      estimatedNetMarginPercent: null,
      reason: `Ticari iddia için en az 6 karşılaştırma ve 2 bağımsız kaynak gerekli; mevcut ${input.comparableCount}/${input.sourceCount}.`,
      evidence: evidence(input, reserve, holdingCost),
    };
  }

  const expectedSalePrice = round(input.medianComparablePrice * (1 - input.profile.conservativeSaleDiscountPercent / 100));
  const netProfit = round(expectedSalePrice - totalCost);
  const margin = totalCost > 0 ? round(netProfit / totalCost * 100) : 0;
  const riskBlocked = input.riskLevel === "critical";
  const approved = !riskBlocked
    && netProfit >= input.profile.minNetProfit
    && margin >= input.profile.minNetMarginPercent
    && input.confidence >= 0.55;
  const reason = riskBlocked
    ? "Kritik risk sinyali nedeniyle alım uyarısı engellendi."
    : approved
      ? `Muhafazakâr satış senaryosunda ${formatMoney(netProfit)} net kâr ve %${margin.toFixed(1)} marj.`
      : `Net ${formatMoney(netProfit)} / %${margin.toFixed(1)}; hedef ${formatMoney(input.profile.minNetProfit)} / %${input.profile.minNetMarginPercent.toFixed(1)} karşılanmadı.`;

  return {
    ...common,
    status: approved ? "approved" : "rejected",
    approved,
    expectedSalePrice,
    estimatedNetProfit: netProfit,
    estimatedNetMarginPercent: margin,
    reason,
    evidence: evidence(input, reserve, holdingCost),
  };
}

export async function assessCommercialOpportunity(
  supabase: Client,
  listing: Listing,
  watchlist: Watchlist,
): Promise<CommercialOpportunityAssessment> {
  if (listing.currency !== watchlist.currency || !listing.price || !listing.brand || !listing.model) {
    return errorAssessment(listing.price ?? 0, "Fiyat/para birimi veya marka-model bilgisi eksik.");
  }
  try {
    const snapshot = await analyzeMarketListing(supabase, listing.id);
    const distribution = isRecord(snapshot.distribution) ? snapshot.distribution : {};
    const median = typeof distribution.median === "number" ? distribution.median : null;
    return calculateCommercialOpportunity({
      purchasePrice: listing.price,
      medianComparablePrice: median,
      comparableCount: snapshot.comparable_count,
      sourceCount: snapshot.source_count,
      confidence: snapshot.confidence,
      riskLevel: snapshot.risk_level,
      profile: profileFromWatchlist(watchlist),
    });
  } catch (error) {
    return errorAssessment(listing.price, error instanceof Error ? error.message : "Piyasa analizi oluşturulamadı.");
  }
}

export async function evaluateAndNotifyCommercialAlert(
  supabase: Client,
  input: { alertId: string; opportunityScore: number; listing: Listing; watchlist: Watchlist },
) {
  const threshold = input.watchlist.instant_alert_score ?? 85;
  if (input.opportunityScore < threshold) return { evaluated: false, sent: false, failed: false };

  const assessment = await assessCommercialOpportunity(supabase, input.listing, input.watchlist);
  const evaluatedAt = new Date().toISOString();
  const { error: updateError } = await supabase.from("listing_alerts").update({
    commercial_status: assessment.status,
    commercial_evaluation_version: COMMERCIAL_EVALUATION_VERSION,
    estimated_purchase_cost: assessment.purchasePrice,
    expected_sale_price: assessment.expectedSalePrice,
    estimated_total_cost: assessment.estimatedTotalCost,
    estimated_net_profit: assessment.estimatedNetProfit,
    estimated_net_margin_percent: assessment.estimatedNetMarginPercent,
    commercial_confidence: assessment.confidence,
    commercial_comparable_count: assessment.comparableCount,
    commercial_evidence: assessment.evidence,
    commercially_evaluated_at: evaluatedAt,
  }).eq("id", input.alertId);
  if (updateError) throw new Error(updateError.message);
  if (!assessment.approved) return { evaluated: true, sent: false, failed: false, assessment };

  const { data: profile, error: profileError } = await supabase
    .from("users_profile")
    .select("telegram_chat_id,telegram_verified_at,locale")
    .eq("id", input.watchlist.user_id)
    .single();
  if (profileError) throw new Error(profileError.message);
  if (!profile.telegram_chat_id || !profile.telegram_verified_at) {
    return { evaluated: true, sent: false, failed: false, assessment };
  }

  const delivery = await sendTelegramMessage(
    profile.telegram_chat_id,
    formatInstantOpportunity(input.listing, input.watchlist, assessment, profile.locale),
  );
  if (delivery.ok) {
    const { error } = await supabase.from("listing_alerts").update({
      status: "sent",
      sent_at: evaluatedAt,
      instant_notified_at: evaluatedAt,
      error: null,
    }).eq("id", input.alertId);
    if (error) throw new Error(error.message);
    return { evaluated: true, sent: true, failed: false, assessment };
  }

  await supabase.from("listing_alerts").update({ error: delivery.error ?? "Telegram teslimatı başarısız" }).eq("id", input.alertId);
  return { evaluated: true, sent: false, failed: true, assessment };
}

export function profileFromWatchlist(watchlist: Watchlist): CommercialProfile {
  return {
    estimatedFixedCosts: watchlist.estimated_fixed_costs ?? 0,
    monthlyHoldingCost: watchlist.monthly_holding_cost ?? 0,
    costReservePercent: watchlist.cost_reserve_percent ?? 10,
    conservativeSaleDiscountPercent: watchlist.conservative_sale_discount_percent ?? 5,
    minNetProfit: watchlist.min_net_profit ?? 3000,
    minNetMarginPercent: watchlist.min_net_margin_percent ?? 12,
    maxInventoryDays: watchlist.max_inventory_days ?? 45,
  };
}

function formatInstantOpportunity(listing: Listing, watchlist: Watchlist, assessment: CommercialOpportunityAssessment, locale: "tr" | "fa") {
  const title = escapeHtml(listing.title || [listing.brand, listing.model, listing.year].filter(Boolean).join(" ") || "Araç ilanı");
  const sale = assessment.expectedSalePrice?.toLocaleString(locale === "fa" ? "fa-IR" : "tr-TR") ?? "-";
  const total = assessment.estimatedTotalCost.toLocaleString(locale === "fa" ? "fa-IR" : "tr-TR");
  const profit = assessment.estimatedNetProfit?.toLocaleString(locale === "fa" ? "fa-IR" : "tr-TR") ?? "-";
  if (locale === "fa") return [
    "🚨 <b>فرصت خرید فوری Vehigo</b>", title,
    `هزینه کل محافظه‌کارانه: ${total} ${listing.currency}`,
    `فروش محافظه‌کارانه: ${sale} ${listing.currency}`,
    `سود خالص تخمینی: ${profit} ${listing.currency} · حاشیه %${assessment.estimatedNetMarginPercent?.toFixed(1) ?? "-"}`,
    `نمونه بازار: ${assessment.comparableCount} آگهی / ${assessment.sourceCount} منبع`,
    `دلیل: ${escapeHtml(assessment.reason)}`,
    `<a href="${escapeHtml(listing.listing_url)}">مشاهده آگهی</a>`,
  ].join("\n");
  return [
    "🚨 <b>Vehigo anlık alım fırsatı</b>", title,
    `Alım profili: ${escapeHtml(watchlist.name)}`,
    `Muhafazakâr toplam maliyet: ${total} ${listing.currency}`,
    `Muhafazakâr satış: ${sale} ${listing.currency}`,
    `Tahmini net kâr: ${profit} ${listing.currency} · Marj %${assessment.estimatedNetMarginPercent?.toFixed(1) ?? "-"}`,
    `Piyasa kanıtı: ${assessment.comparableCount} ilan / ${assessment.sourceCount} kaynak`,
    `Neden: ${escapeHtml(assessment.reason)}`,
    `<a href="${escapeHtml(listing.listing_url)}">İlanı hemen aç</a>`,
  ].join("\n");
}

function errorAssessment(purchasePrice: number, reason: string): CommercialOpportunityAssessment {
  return { status: "error", approved: false, purchasePrice, medianComparablePrice: null, expectedSalePrice: null, estimatedTotalCost: purchasePrice, estimatedNetProfit: null, estimatedNetMarginPercent: null, comparableCount: 0, sourceCount: 0, confidence: 0, reason, evidence: { version: COMMERCIAL_EVALUATION_VERSION, error: reason } };
}

function evidence(input: Parameters<typeof calculateCommercialOpportunity>[0], reserve: number, holdingCost: number): Json {
  return {
    version: COMMERCIAL_EVALUATION_VERSION,
    profile: input.profile,
    inputs: { purchasePrice: input.purchasePrice, medianComparablePrice: input.medianComparablePrice, comparableCount: input.comparableCount, sourceCount: input.sourceCount, confidence: input.confidence, riskLevel: input.riskLevel },
    calculated: { acquisitionReserve: round(reserve), holdingCost: round(holdingCost) },
  } as unknown as Json;
}

function isRecord(value: Json | null): value is { [key: string]: Json } {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
function round(value: number) { return Math.round((value + Number.EPSILON) * 100) / 100; }
function formatMoney(value: number) { return `${value.toLocaleString("tr-TR")} EUR`; }
function escapeHtml(value: string) { return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;"); }

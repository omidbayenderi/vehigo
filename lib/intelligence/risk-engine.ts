import type { MarketComparison } from "./market-intelligence";

export type PricePoint = { price: number | null; currency: string | null; recordedAt: string };
export type RiskSignal = { code: string; severity: "info" | "warning" | "high"; title: string; evidence: string; points: number };

export type RiskInput = {
  listing: {
    price: number | null;
    currency: string;
    firstSeenAt: string;
    title: string | null;
    description?: string | null;
    sellerName: string | null;
    sellerType?: string | null;
    vin?: string | null;
    year: number | null;
    mileageKm: number | null;
    normalizationConfidence?: number | null;
    normalizationWarnings?: string[];
    condition?: string | null;
  };
  comparison: MarketComparison;
  priceHistory: PricePoint[];
  sellerInventoryCount: number;
};

export function analyzeRisk(input: RiskInput, now = new Date()) {
  const signals: RiskSignal[] = [];
  const add = (signal: RiskSignal) => signals.push(signal);
  const trend = analyzePriceTrend(input.priceHistory);

  if (input.comparison.claimEligible && input.comparison.underpricingPercent !== null && input.comparison.underpricingPercent >= 25) {
    add({ code: "price_far_below_market", severity: "high", title: "Pazar medyanının belirgin altında", evidence: `%${input.comparison.underpricingPercent.toFixed(1)} aşağıda; ${input.comparison.comparableCount} uygun ilan`, points: 28 });
  } else if (input.comparison.claimEligible && (input.comparison.underpricingPercent ?? 0) >= 12) {
    add({ code: "price_below_market", severity: "warning", title: "Pazar medyanının altında", evidence: `%${input.comparison.underpricingPercent?.toFixed(1)} aşağıda`, points: 12 });
  }
  if (!input.comparison.claimEligible) add({ code: "weak_market_sample", severity: "warning", title: "Pazar örneklemi yetersiz", evidence: `${input.comparison.comparableCount} ilan, ${input.comparison.sourceCount} kaynak`, points: 8 });
  if (trend.dropCount >= 3 || (trend.changePercent !== null && trend.changePercent <= -20)) add({ code: "repeated_price_drops", severity: "warning", title: "Tekrarlanan fiyat düşüşü", evidence: `${trend.dropCount} düşüş; toplam değişim %${Math.abs(trend.changePercent ?? 0).toFixed(1)}`, points: 14 });

  const ageDays = Math.max(0, Math.floor((now.getTime() - new Date(input.listing.firstSeenAt).getTime()) / 86_400_000));
  if (ageDays >= 90) add({ code: "stale_listing", severity: "warning", title: "Uzun süredir yayında", evidence: `${ageDays} gündür gözlemleniyor`, points: 10 });
  if (!input.listing.sellerName) add({ code: "missing_seller_identity", severity: "warning", title: "Satıcı kimliği eksik", evidence: "Kaynak kaydında satıcı adı bulunmuyor", points: 10 });
  if (!input.listing.vin) add({ code: "missing_vin", severity: "info", title: "VIN doğrulanmadı", evidence: "VIN bilgisi kaynakta bulunmuyor", points: 5 });
  if (input.listing.year === null || input.listing.mileageKm === null) add({ code: "missing_vehicle_facts", severity: "warning", title: "Temel araç bilgisi eksik", evidence: "Yıl veya kilometre bilgisi tamamlanmamış", points: 8 });
  if ((input.listing.normalizationConfidence ?? 1) < 0.7 || (input.listing.normalizationWarnings?.length ?? 0) >= 3) add({ code: "low_normalization_confidence", severity: "warning", title: "Veri eşleme güveni düşük", evidence: `${input.listing.normalizationWarnings?.length ?? 0} normalizasyon uyarısı`, points: 10 });
  if (input.listing.condition === "damaged") add({ code: "declared_damage", severity: "high", title: "Hasarlı olarak işaretlenmiş", evidence: "İlan koşul alanı hasarlı", points: 25 });
  if (hasSuspiciousTerms(`${input.listing.title ?? ""} ${input.listing.description ?? ""}`)) add({ code: "suspicious_payment_language", severity: "high", title: "Doğrulama gerektiren ödeme dili", evidence: "Kapora, kripto veya platform dışı ödeme ifadesi algılandı", points: 25 });

  const score = Math.min(100, signals.reduce((sum, signal) => sum + signal.points, 0));
  const level: "low" | "medium" | "high" | "critical" = score >= 60 ? "critical" : score >= 35 ? "high" : score >= 16 ? "medium" : "low";
  return {
    score,
    level: signals.length ? level : "low",
    signals,
    priceTrend: trend,
    sellerSignals: {
      identityPresent: Boolean(input.listing.sellerName),
      declaredType: input.listing.sellerType ?? "unknown",
      observedInventoryCount: input.sellerInventoryCount,
      interpretation: "Gözlemsel sinyaldir; satıcı güvenilirliği veya hukuki doğrulama değildir.",
    },
  };
}

export function analyzePriceTrend(history: PricePoint[]) {
  const points = history.filter((point): point is PricePoint & { price: number } => typeof point.price === "number" && point.price > 0).sort((a, b) => Date.parse(a.recordedAt) - Date.parse(b.recordedAt));
  let dropCount = 0;
  for (let index = 1; index < points.length; index++) if (points[index].price < points[index - 1].price) dropCount++;
  const first = points[0]?.price ?? null;
  const current = points.at(-1)?.price ?? null;
  const changePercent = first && current ? Math.round(((current - first) / first) * 10_000) / 100 : null;
  return { observations: points.length, first, current, min: points.length ? Math.min(...points.map((point) => point.price)) : null, max: points.length ? Math.max(...points.map((point) => point.price)) : null, dropCount, changePercent };
}

function hasSuspiciousTerms(value: string) {
  const normalized = value.toLocaleLowerCase("tr-TR");
  return ["kapora gönder", "crypto only", "bitcoin only", "western union", "outside the platform", "platform dışında ödeme"].some((term) => normalized.includes(term));
}

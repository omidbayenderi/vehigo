import { describe, expect, it } from "vitest";
import { analyzeRisk, analyzePriceTrend } from "@/lib/intelligence/risk-engine";
import type { MarketComparison } from "@/lib/intelligence/market-intelligence";

const comparison: MarketComparison = { selected: [], distribution: { min: 30_000, q1: 32_000, median: 35_000, q3: 38_000, max: 40_000, mean: 35_000, iqr: 6_000 }, sampleQuality: "medium", claimEligible: true, comparableCount: 8, sourceCount: 2, underpricingPercent: 42.86, confidence: 0.8, excluded: {} };

describe("risk engine", () => {
  it("calculates chronological price drops", () => {
    expect(analyzePriceTrend([
      { price: 100, currency: "EUR", recordedAt: "2026-01-01" },
      { price: 90, currency: "EUR", recordedAt: "2026-01-02" },
      { price: 80, currency: "EUR", recordedAt: "2026-01-03" },
    ])).toMatchObject({ dropCount: 2, changePercent: -20, first: 100, current: 80 });
  });

  it("records evidence-backed risks without claiming seller trust", () => {
    const result = analyzeRisk({
      listing: { price: 20_000, currency: "EUR", firstSeenAt: "2025-01-01", title: "Kapora gönder", sellerName: null, sellerType: "unknown", vin: null, year: 2022, mileageKm: 180_000, normalizationConfidence: 0.9, normalizationWarnings: [], condition: "used_good" },
      comparison,
      priceHistory: [],
      sellerInventoryCount: 0,
    }, new Date("2026-01-01"));
    expect(result.level).toBe("critical");
    expect(result.signals.map((signal) => signal.code)).toEqual(expect.arrayContaining(["price_far_below_market", "suspicious_payment_language", "missing_seller_identity"]));
    expect(result.sellerSignals.interpretation).toContain("güvenilirliği");
  });
});

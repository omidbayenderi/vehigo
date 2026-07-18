import { describe, expect, it } from "vitest";
import { calculateCommercialOpportunity, type CommercialProfile } from "@/lib/services/commercial-opportunity";

const profile: CommercialProfile = {
  estimatedFixedCosts: 3_000,
  monthlyHoldingCost: 300,
  costReservePercent: 10,
  conservativeSaleDiscountPercent: 5,
  minNetProfit: 5_000,
  minNetMarginPercent: 12,
  maxInventoryDays: 45,
};

describe("commercial opportunity economics", () => {
  it("approves only after conservative costs and sale discount still clear both targets", () => {
    const result = calculateCommercialOpportunity({
      purchasePrice: 30_000,
      medianComparablePrice: 45_000,
      comparableCount: 9,
      sourceCount: 3,
      confidence: 0.82,
      riskLevel: "low",
      profile,
    });

    expect(result).toMatchObject({
      status: "approved",
      approved: true,
      expectedSalePrice: 42_750,
      estimatedTotalCost: 36_450,
      estimatedNetProfit: 6_300,
    });
    expect(result.estimatedNetMarginPercent).toBeCloseTo(17.28, 2);
  });

  it("refuses a commercial claim when source independence is missing", () => {
    const result = calculateCommercialOpportunity({
      purchasePrice: 20_000,
      medianComparablePrice: 40_000,
      comparableCount: 12,
      sourceCount: 1,
      confidence: 0.9,
      riskLevel: "low",
      profile,
    });

    expect(result.status).toBe("insufficient_data");
    expect(result.approved).toBe(false);
    expect(result.reason).toContain("2 bağımsız kaynak");
  });

  it("blocks a mathematically profitable listing with critical risk", () => {
    const result = calculateCommercialOpportunity({
      purchasePrice: 20_000,
      medianComparablePrice: 45_000,
      comparableCount: 8,
      sourceCount: 3,
      confidence: 0.85,
      riskLevel: "critical",
      profile,
    });

    expect(result.status).toBe("rejected");
    expect(result.approved).toBe(false);
    expect(result.reason).toContain("Kritik risk");
  });
});

import { describe, expect, it } from "vitest";
import { analyzeComparables, priceDistribution, type ComparableListing } from "@/lib/intelligence/market-intelligence";

const subject: ComparableListing = { id: "subject", sourceKey: "a", duplicateClusterId: "subject-cluster", price: 20_000, currency: "EUR", brand: "Mercedes-Benz", model: "Actros", year: 2022, mileageKm: 180_000, countryCode: "DE", vehicleType: "truck", fuelType: "diesel", transmission: "automatic", status: "active" };

function candidate(index: number, overrides: Partial<ComparableListing> = {}): ComparableListing {
  return { id: `c-${index}`, sourceKey: index % 2 ? "mobile" : "autoscout", duplicateClusterId: `cluster-${index}`, price: 30_000 + index * 500, currency: "EUR", brand: "Mercedes-Benz", model: "Actros", year: 2021 + index % 3, mileageKm: 170_000 + index * 2_000, countryCode: "DE", vehicleType: "truck", fuelType: "diesel", transmission: "automatic", status: "active", ...overrides };
}

describe("market intelligence", () => {
  it("computes an interpolated price distribution", () => {
    expect(priceDistribution([10, 20, 30, 40])).toEqual({ min: 10, q1: 17.5, median: 25, q3: 32.5, max: 40, mean: 25, iqr: 15 });
  });

  it("never emits an underpricing claim for a weak sample", () => {
    const result = analyzeComparables(subject, [candidate(1), candidate(2), candidate(3, { sourceKey: "mobile" })]);
    expect(result.claimEligible).toBe(false);
    expect(result.underpricingPercent).toBeNull();
  });

  it("deduplicates the same vehicle and makes eligible claims reproducible", () => {
    const candidates = Array.from({ length: 9 }, (_, index) => candidate(index));
    candidates.push(candidate(20, { duplicateClusterId: "cluster-1", price: 99_000 }));
    const result = analyzeComparables(subject, candidates);
    expect(result.claimEligible).toBe(true);
    expect(result.comparableCount).toBe(9);
    expect(result.sourceCount).toBe(2);
    expect(result.underpricingPercent).toBeGreaterThan(30);
  });

  it("excludes currency, taxonomy and same-vehicle contamination", () => {
    const result = analyzeComparables(subject, [candidate(1, { currency: "USD" }), candidate(2, { model: "Atego" }), candidate(3, { duplicateClusterId: "subject-cluster" })]);
    expect(result.comparableCount).toBe(0);
    expect(result.excluded).toMatchObject({ currency: 1, taxonomy: 1, same_vehicle: 1 });
  });
});

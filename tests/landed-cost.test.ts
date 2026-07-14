import { describe, expect, it } from "vitest";
import { calculateLandedCost, convertMoney, type LandedCostInput } from "@/lib/export/landed-cost";

const base: LandedCostInput = {
  vehiclePrice: 20_000,
  vehicleCurrency: "EUR",
  calculationCurrency: "EUR",
  originCountryCode: "DE",
  destinationCountryCode: "IR",
  transportMode: "road",
  vehicleCategory: "truck",
  buyerProfile: "commercial_buyer",
  manualCosts: [
    { code: "transport", label: "Nakliye", category: "logistics", amount: 2_000, currency: "EUR", evidence: "carrier-quote-1" },
    { code: "insurance", label: "Sigorta", category: "insurance", amount: 200, currency: "EUR", evidence: "policy-quote-1" },
  ],
  rules: [{ id: "customs", code: "customs", label: "Gümrük", category: "customs", calculationType: "percentage", baseKey: "customs_value", ratePercent: 10, conditions: { destinationCountryCodes: ["IR"] }, evidenceRequired: true }],
  exchangeRates: [],
};

describe("landed cost engine", () => {
  it("calculates ordered cost lines and customs-value percentage", () => {
    const result = calculateLandedCost(base);
    expect(result.totals).toMatchObject({ vehicle: 20_000, logistics: 2_200, taxesAndCustoms: 2_220, landedCost: 24_420, currency: "EUR" });
    expect(result.costLines.at(-1)).toMatchObject({ code: "customs", amount: 2_220, source: "rule" });
  });

  it("uses direct and inverse immutable exchange-rate snapshots", () => {
    const rates = [{ id: "fx", baseCurrency: "EUR", quoteCurrency: "USD", rate: 1.25, provider: "manual", observedAt: "2026-07-13T00:00:00Z" }];
    expect(convertMoney(100, "EUR", "USD", rates)).toBe(125);
    expect(convertMoney(125, "USD", "EUR", rates)).toBe(100);
  });

  it("fails closed when a required exchange-rate snapshot is missing", () => {
    expect(() => calculateLandedCost({ ...base, vehicleCurrency: "USD" })).toThrow("USD/EUR için kur snapshot'ı bulunamadı");
  });

  it("marks blocking compliance rules and missing manual evidence", () => {
    const result = calculateLandedCost({ ...base, manualCosts: [{ ...base.manualCosts[0], evidence: undefined }], rules: [{ id: "legal", code: "legal", label: "İhracat izni", category: "compliance", calculationType: "fixed", amount: 0, currency: "EUR", blocking: true }] });
    expect(result.compliance.calculationComplete).toBe(false);
    expect(result.compliance.blockers[0]).toContain("manuel uygunluk onayı");
    expect(result.compliance.manualEvidenceMissing).toEqual(["transport"]);
  });

  it("produces deterministic stress scenarios above the baseline", () => {
    const result = calculateLandedCost(base);
    expect(result.sensitivity).toHaveLength(4);
    expect(result.sensitivity.every((item) => item.landedCost >= result.totals.landedCost)).toBe(true);
  });
});

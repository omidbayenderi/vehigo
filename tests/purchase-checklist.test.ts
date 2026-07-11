import { describe, expect, it } from "vitest";
import { calculateAcquisitionCost } from "@/lib/services/purchase-checklist";

const baseChecklist = {
  estimated_transport_cost: 1500,
  estimated_insurance_cost: 200,
  estimated_customs_cost: 3000,
  estimated_prep_cost: 400,
};

describe("calculateAcquisitionCost", () => {
  it("sums the listing price with all estimated cost lines", () => {
    expect(calculateAcquisitionCost(20000, baseChecklist)).toBe(25100);
  });

  it("treats a missing listing price as zero rather than throwing", () => {
    expect(calculateAcquisitionCost(null, baseChecklist)).toBe(5100);
  });

  it("rounds to two decimal places", () => {
    expect(calculateAcquisitionCost(10000.111, { ...baseChecklist, estimated_prep_cost: 400.005 })).toBe(15100.12);
  });
});

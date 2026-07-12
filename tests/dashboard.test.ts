import { describe, expect, it } from "vitest";
import { groupMoneyByCurrency } from "@/lib/services/dashboard";

describe("groupMoneyByCurrency", () => {
  it("keeps unlike currencies separate instead of producing a false total", () => {
    expect(groupMoneyByCurrency([
      { amount: 1_000, currency: "EUR" },
      { amount: 500, currency: "eur" },
      { amount: 2_000, currency: "USD" },
    ])).toEqual([
      { currency: "USD", amount: 2_000 },
      { currency: "EUR", amount: 1_500 },
    ]);
  });

  it("handles null amounts and missing currencies safely", () => {
    expect(groupMoneyByCurrency([
      { amount: null, currency: "EUR" },
      { amount: 250, currency: null },
    ])).toEqual([{ currency: "EUR", amount: 250 }]);
  });
});

import { describe, expect, it } from "vitest";
import { calculateConservativeArbitrage } from "@/lib/services/arbitrage-agent";

describe("calculateConservativeArbitrage", () => {
  it("requires at least three comparable listings", () => {
    expect(calculateConservativeArbitrage(10_000, [16_000, 17_000])).toBeNull();
  });

  it("uses the median and a conservative 10 percent acquisition reserve", () => {
    const result = calculateConservativeArbitrage(10_000, [15_000, 16_500, 18_000]);
    expect(result?.median).toBe(16_500);
    expect(result?.totalCost).toBe(11_000);
    expect(result?.netProfitPercent).toBeCloseTo(50, 5);
  });
});

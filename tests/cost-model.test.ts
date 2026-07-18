import { describe, expect, it } from "vitest";
import { DEFAULT_MONTHLY_COST_INPUT, estimateMonthlyOperatingCost } from "@/lib/operations/cost-model";

describe("monthly operating cost model", () => {
  it("makes provider volume and every fixed assumption explicit", () => {
    const result = estimateMonthlyOperatingCost(DEFAULT_MONTHLY_COST_INPUT);
    expect(result.braveRequests).toBe(16_200);
    expect(result.lines.find((line) => line.key === "brave")?.usd).toBe(76);
    expect(result.lines.find((line) => line.key === "apify_usage")?.usd).toBe(21);
    expect(result.totalUsd).toBe(181);
  });
});

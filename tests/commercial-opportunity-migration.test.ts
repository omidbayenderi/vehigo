import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync("supabase/migrations/20260718122940_commercial_opportunity_engine.sql", "utf8");

describe("commercial opportunity migration", () => {
  it("adds conservative buying-profile inputs and reproducible alert outputs", () => {
    for (const column of [
      "estimated_fixed_costs", "monthly_holding_cost", "cost_reserve_percent",
      "conservative_sale_discount_percent", "min_net_profit", "min_net_margin_percent",
      "commercial_status", "estimated_total_cost", "estimated_net_profit", "commercial_evidence",
    ]) expect(migration).toContain(column);
    expect(migration).toMatch(/where status = 'pending'/i);
  });

  it("fails the known Marktplaats authorization risk closed", () => {
    expect(migration).toMatch(/where key = 'apify_marktplaats'/i);
    expect(migration).toMatch(/set enabled = false/i);
    expect(migration).toContain("Written Marktplaats API/reuse authorization is required");
  });
});

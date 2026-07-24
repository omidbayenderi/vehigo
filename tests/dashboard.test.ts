import { describe, expect, it } from "vitest";
import { combineScannerMetrics, groupMoneyByCurrency } from "@/lib/services/dashboard";

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

describe("combineScannerMetrics", () => {
  it("includes the consolidated Web Scout in source count, volume, and last-success metrics", () => {
    expect(combineScannerMetrics({
      runtimeSources: [],
      siteAgents: [{
        source_key: "brave_web",
        status: "active",
        last_success_at: "2026-07-24T08:30:00.000Z",
      }],
      scannerRuns: [],
      siteAgentRuns: [{ inserted_count: 7, alerts_created: 2 }],
      lastScannerRun: {
        new_count: 0,
        alert_count: 0,
        started_at: "2026-07-18T08:30:00.000Z",
        finished_at: "2026-07-18T08:31:00.000Z",
      },
      scannerHealthIssueCount: 0,
    })).toEqual({
      activeSourceCount: 1,
      healthySourceCount: 1,
      listingsDiscovered24h: 7,
      alertsCreated24h: 2,
      lastSuccessfulScanAt: "2026-07-24T08:30:00.000Z",
    });
  });

  it("deduplicates a source represented by both runtime and Web Scout records", () => {
    expect(combineScannerMetrics({
      runtimeSources: [{ key: "brave_web" }],
      siteAgents: [{
        source_key: "brave_web",
        status: "active",
        last_success_at: null,
      }],
      scannerRuns: [{ new_count: 3, alert_count: 1 }],
      siteAgentRuns: [{ inserted_count: 4, alerts_created: 2 }],
      lastScannerRun: null,
      scannerHealthIssueCount: 1,
    })).toMatchObject({
      activeSourceCount: 1,
      healthySourceCount: 0,
      listingsDiscovered24h: 7,
      alertsCreated24h: 3,
    });
  });
});

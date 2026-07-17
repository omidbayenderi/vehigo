import { describe, expect, it } from "vitest";
import { scannerRunHasCriticalFailures } from "@/lib/scanner/run-health";

function summary(overrides: Record<string, unknown> = {}) {
  return {
    failed: [],
    skipped: [],
    ingestReplayFailed: 0,
    alertsFailed: 0,
    maintenanceFailed: false,
    siteAgents: { failed: 0, blocked: 0 },
    ...overrides,
  } as never;
}

describe("scanner run HTTP health signal", () => {
  it("treats connector, fleet failure, and fleet block as degraded", () => {
    expect(scannerRunHasCriticalFailures(summary({ failed: [{ sourceKey: "x", error: "failed" }] }))).toBe(true);
    expect(scannerRunHasCriticalFailures(summary({ siteAgents: { failed: 1, blocked: 0 } }))).toBe(true);
    expect(scannerRunHasCriticalFailures(summary({ siteAgents: { failed: 0, blocked: 1 } }))).toBe(true);
  });

  it("keeps healthy and partial-only runs successful", () => {
    expect(scannerRunHasCriticalFailures(summary())).toBe(false);
    expect(scannerRunHasCriticalFailures(summary({ siteAgents: { failed: 0, blocked: 0, partial: 1 } }))).toBe(false);
  });

  it("degrades on replay, maintenance, and required-source skips but allows the legal Brave skip", () => {
    expect(scannerRunHasCriticalFailures(summary({ ingestReplayFailed: 1 }))).toBe(true);
    expect(scannerRunHasCriticalFailures(summary({ maintenanceFailed: true }))).toBe(true);
    expect(scannerRunHasCriticalFailures(summary({ skipped: ["mobile_de"] }))).toBe(true);
    expect(scannerRunHasCriticalFailures(summary({ skipped: ["brave_web"] }))).toBe(false);
  });

  it("allows brave_web's own storage-rights failure but still degrades on any other source failure", () => {
    expect(scannerRunHasCriticalFailures(summary({
      failed: [{ sourceKey: "brave_web", error: "Brave Search sonuçlarını saklama hakkı doğrulanmadı" }],
    }))).toBe(false);
    expect(scannerRunHasCriticalFailures(summary({
      failed: [{ sourceKey: "brave_web", error: "..." }, { sourceKey: "apify_mobile_de", error: "timeout" }],
    }))).toBe(true);
  });
});

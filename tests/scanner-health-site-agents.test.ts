import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/scanner/registry", () => ({ getConnector: vi.fn() }));
vi.mock("@/lib/services/source-catalog", () => ({ connectorContractIssues: vi.fn(() => []) }));

import { checkScannerHealth } from "@/lib/services/scanner-health";

function resolvedQuery(result: { data?: unknown; error: { message: string } | null; count?: number }) {
  const chain: Record<string, unknown> = {};
  for (const method of ["select", "eq", "in", "lt", "order", "limit", "maybeSingle"]) {
    chain[method] = vi.fn(() => chain);
  }
  chain.then = (resolve: (value: unknown) => unknown) => Promise.resolve(result).then(resolve);
  return chain;
}

describe("site-agent fleet health", () => {
  it("reports pending agents as one actionable fleet issue", async () => {
    const from = vi.fn((table: string) => {
      if (table === "market_sources") return resolvedQuery({ data: [], error: null });
      if (table === "scanner_ingest_events") return resolvedQuery({ count: 0, error: null });
      if (table === "site_search_agents") return resolvedQuery({
        data: [{
          status: "pending_activation",
          last_started_at: null,
          last_status: null,
          last_error_message: null,
          interval_minutes: 480,
        }],
        error: null,
      });
      throw new Error(`Unexpected table: ${table}`);
    });

    const issues = await checkScannerHealth({ from } as never);

    expect(issues).toEqual([expect.objectContaining({
      sourceKey: "site_agent_fleet",
      kind: "never_ran",
      severity: "critical",
      detail: "1 birleşik agent aktivasyon bekliyor",
    })]);
  });

  it("treats the first transient failure as recovering and includes the safe cause", async () => {
    const from = vi.fn((table: string) => {
      if (table === "market_sources") return resolvedQuery({ data: [], error: null });
      if (table === "scanner_ingest_events") return resolvedQuery({ count: 0, error: null });
      if (table === "site_search_agents") return resolvedQuery({
        data: [{
          status: "active", last_started_at: new Date().toISOString(), last_status: "failed",
          last_error_code: "provider_timeout", last_error_message: "request timed out",
          consecutive_failures: 1, next_run_at: "2026-08-30T15:00:00.000Z", interval_minutes: 160,
        }],
        error: null,
      });
      throw new Error(`Unexpected table: ${table}`);
    });

    const issues = await checkScannerHealth({ from } as never);

    expect(issues).toEqual([expect.objectContaining({
      kind: "recovering", severity: "warning", detail: expect.stringContaining("Sağlayıcı zaman aşımı"),
    })]);
  });

  it("escalates repeated failures and exposes the actionable error category", async () => {
    const from = vi.fn((table: string) => {
      if (table === "market_sources") return resolvedQuery({ data: [], error: null });
      if (table === "scanner_ingest_events") return resolvedQuery({ count: 0, error: null });
      if (table === "site_search_agents") return resolvedQuery({
        data: [{
          status: "active", last_started_at: new Date().toISOString(), last_status: "failed",
          last_error_code: "provider_rate_limited", last_error_message: "HTTP 429",
          consecutive_failures: 2, next_run_at: null, interval_minutes: 160,
        }],
        error: null,
      });
      throw new Error(`Unexpected table: ${table}`);
    });

    const issues = await checkScannerHealth({ from } as never);

    expect(issues).toEqual([expect.objectContaining({
      kind: "failing", severity: "critical", detail: expect.stringContaining("Sağlayıcı hız limiti"),
    })]);
  });
});

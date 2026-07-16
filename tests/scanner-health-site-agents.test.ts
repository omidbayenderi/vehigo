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
        data: Array.from({ length: 45 }, () => ({
          status: "pending_activation",
          last_started_at: null,
          last_status: null,
          last_error_message: null,
          interval_minutes: 480,
        })),
        error: null,
      });
      throw new Error(`Unexpected table: ${table}`);
    });

    const issues = await checkScannerHealth({ from } as never);

    expect(issues).toEqual([expect.objectContaining({
      sourceKey: "site_agent_fleet",
      kind: "never_ran",
      detail: "45 bağımsız ajan aktivasyon bekliyor",
    })]);
  });
});

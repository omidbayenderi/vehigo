import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createEmptySiteAgentFleetSummary: vi.fn(() => ({
    claimed: 0, completed: 0, partial: 0, blocked: 0, failed: 0,
    fetched: 0, inserted: 0, alertsCreated: 0, alertsSent: 0, alertsFailed: 0,
    transientCompleted: 0, persistentCompleted: 0, sources: [],
  })),
  getConnector: vi.fn(),
  listActiveWatchlistsForScanner: vi.fn(),
  listDueScannerSources: vi.fn(),
  markStaleListingsAsDelisted: vi.fn(),
  prepareSiteSearchAgentFleet: vi.fn(),
  processIncomingListings: vi.fn(),
  purgeRpc: vi.fn(),
  recordScannerRun: vi.fn(),
  replayDueIngestEvents: vi.fn(),
  runDueSiteSearchAgents: vi.fn(),
  syncRuntimeConnectorCatalog: vi.fn(),
}));

vi.mock("@/lib/services/market-alerts", () => ({
  listActiveWatchlistsForScanner: mocks.listActiveWatchlistsForScanner,
  listDueScannerSources: mocks.listDueScannerSources,
  markStaleListingsAsDelisted: mocks.markStaleListingsAsDelisted,
  processIncomingListings: mocks.processIncomingListings,
  recordScannerRun: mocks.recordScannerRun,
}));
vi.mock("@/lib/scanner/registry", () => ({ getConnector: mocks.getConnector }));
vi.mock("@/lib/services/source-catalog", () => ({ syncRuntimeConnectorCatalog: mocks.syncRuntimeConnectorCatalog }));
vi.mock("@/lib/services/scanner-ingest", () => ({ replayDueIngestEvents: mocks.replayDueIngestEvents }));
vi.mock("@/lib/scanner/site-search-agents", () => ({
  createEmptySiteAgentFleetSummary: mocks.createEmptySiteAgentFleetSummary,
  prepareSiteSearchAgentFleet: mocks.prepareSiteSearchAgentFleet,
  runDueSiteSearchAgents: mocks.runDueSiteSearchAgents,
}));

import { runScannerOnce } from "@/lib/scanner/runner";

function client() {
  return { rpc: mocks.purgeRpc } as never;
}

describe("scanner runner site-agent integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.prepareSiteSearchAgentFleet.mockResolvedValue(true);
    mocks.replayDueIngestEvents.mockResolvedValue({ replayed: 0, failed: 0 });
    mocks.purgeRpc.mockResolvedValue({ data: 0, error: null });
    mocks.listDueScannerSources.mockResolvedValue([]);
    mocks.listActiveWatchlistsForScanner.mockResolvedValue([]);
    mocks.markStaleListingsAsDelisted.mockResolvedValue(2);
  });

  it("merges the single leased agent totals into the scanner summary", async () => {
    mocks.runDueSiteSearchAgents.mockResolvedValue({
      claimed: 1, completed: 1, partial: 0, blocked: 0, failed: 0,
      fetched: 4, inserted: 3, alertsCreated: 2, alertsSent: 0, alertsFailed: 0,
      transientCompleted: 0, persistentCompleted: 1, sources: [{ sourceKey: "mobile_de", status: "ok" }],
    });

    const result = await runScannerOnce(client());

    expect(result).toMatchObject({ fetched: 4, inserted: 3, alertsCreated: 2, delisted: 2 });
    expect(mocks.runDueSiteSearchAgents).toHaveBeenCalledWith(
      expect.anything(),
      [],
      expect.objectContaining({ limit: 1, chefRunId: expect.any(String) }),
    );
  });

  it("propagates a manual force request to the site-agent claim", async () => {
    mocks.runDueSiteSearchAgents.mockResolvedValue({
      claimed: 1, completed: 1, partial: 0, blocked: 0, failed: 0,
      fetched: 12, inserted: 0, alertsCreated: 1, alertsSent: 1, alertsFailed: 0,
      transientCompleted: 1, persistentCompleted: 0, sources: [{ sourceKey: "mobile_de", status: "ok" }],
    });

    const result = await runScannerOnce(client(), { force: true });

    expect(mocks.runDueSiteSearchAgents).toHaveBeenCalledWith(
      expect.anything(),
      [],
      expect.objectContaining({ force: true }),
    );
    expect(result.delisted).toBe(0);
    expect(mocks.markStaleListingsAsDelisted).not.toHaveBeenCalled();
  });

  it("surfaces fleet failure without delisting records when no persistent discovery ran", async () => {
    mocks.runDueSiteSearchAgents.mockRejectedValue(new Error("stale lease"));

    const result = await runScannerOnce(client());

    expect(result.failed).toEqual([{ sourceKey: "site_agent_fleet", error: "stale lease" }]);
    expect(result.delisted).toBe(0);
    expect(mocks.markStaleListingsAsDelisted).not.toHaveBeenCalled();
  });

  it("fails closed without calling Brave when storage rights are not verified", async () => {
    mocks.prepareSiteSearchAgentFleet.mockResolvedValue(false);
    mocks.listDueScannerSources.mockResolvedValue([{ key: "brave_web" }]);

    const result = await runScannerOnce(client());

    expect(result.skipped).toContain("brave_web");
    expect(mocks.getConnector).not.toHaveBeenCalled();
    expect(mocks.recordScannerRun).toHaveBeenCalledWith(
      expect.anything(),
      "brave_web",
      expect.any(Date),
      expect.objectContaining({ status: "skipped" }),
    );
    expect(mocks.runDueSiteSearchAgents).not.toHaveBeenCalled();
  });
});

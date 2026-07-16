import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  fetchSiteSearchAgentListings: vi.fn(),
  processIncomingListings: vi.fn(),
}));

vi.mock("@/lib/scanner/adapters/brave-web", () => ({
  fetchSiteSearchAgentListings: mocks.fetchSiteSearchAgentListings,
}));
vi.mock("@/lib/services/market-alerts", () => ({
  processIncomingListings: mocks.processIncomingListings,
}));

import {
  classifySiteAgentError,
  prepareSiteSearchAgentFleet,
  runDueSiteSearchAgents,
} from "@/lib/scanner/site-search-agents";

const agent = {
  id: "00000000-0000-4000-8000-000000000027",
  source_key: "mobile_de",
  host: "mobile.de",
  provider_key: "brave_web",
  acquisition_mode: "web_index",
  egress_policy: "provider_managed",
  status: "active",
  interval_minutes: 60,
  jitter_percent: 0,
  max_queries_per_run: 4,
  max_pages_per_query: 2,
  daily_query_limit: 48,
  daily_request_count: 4,
  daily_budget_date: "2026-07-14",
  reserved_request_count: 4,
  query_cursor: 3,
  next_run_at: "2026-07-14T00:00:00.000Z",
  locked_until: "2026-07-14T00:05:00.000Z",
  locked_by: "fleet-test",
  lease_token: "00000000-0000-4000-8000-000000000029",
  last_started_at: "2026-07-14T00:00:00.000Z",
  last_completed_at: null,
  last_success_at: null,
  last_status: null,
  last_error_code: null,
  last_error_message: null,
  consecutive_failures: 0,
  created_at: "2026-07-14T00:00:00.000Z",
  updated_at: "2026-07-14T00:00:00.000Z",
} as const;

function rpcClient(input: {
  claim?: { data: unknown; error: { code?: string; message: string } | null };
  finishError?: { message: string } | null;
} = {}) {
  const finishCalls: unknown[] = [];
  const rpc = vi.fn(async (name: string, args: unknown) => {
    if (name === "reconcile_site_search_agent_fleet") return { data: 45, error: null };
    if (name === "activate_site_search_agent_fleet") return { data: 3, error: null };
    if (name === "claim_due_site_search_agents") {
      return input.claim ?? { data: [agent], error: null };
    }
    if (name === "start_site_search_agent_run") {
      return { data: "00000000-0000-4000-8000-000000000028", error: null };
    }
    if (name === "finish_site_search_agent_run") {
      finishCalls.push(args);
      return { data: input.finishError ? null : true, error: input.finishError ?? null };
    }
    throw new Error(`Unexpected RPC: ${name}`);
  });
  return { client: { rpc }, rpc, finishCalls };
}

describe("site search agent fleet", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.BRAVE_SEARCH_API_KEY = "test-key";
    process.env.BRAVE_SEARCH_STORAGE_RIGHTS_CONFIRMED = "true";
  });

  afterEach(() => {
    delete process.env.BRAVE_SEARCH_API_KEY;
    delete process.env.BRAVE_SEARCH_STORAGE_RIGHTS_CONFIRMED;
  });

  it("does not activate the fleet before provider storage rights are confirmed", async () => {
    process.env.BRAVE_SEARCH_STORAGE_RIGHTS_CONFIRMED = "false";
    const { client, rpc } = rpcClient();
    const logger = { warn: vi.fn() };

    await expect(prepareSiteSearchAgentFleet(client as never, logger)).resolves.toBe(false);

    expect(rpc).toHaveBeenCalledWith("reconcile_site_search_agent_fleet", {});
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining("etkinleştirilmedi"));
  });

  it("validates provider configuration without auto-resuming paused agents", async () => {
    const { client, rpc } = rpcClient();

    await expect(prepareSiteSearchAgentFleet(client as never)).resolves.toBe(true);

    expect(rpc).toHaveBeenCalledWith("reconcile_site_search_agent_fleet", {});
  });

  it("degrades safely when migration 0027 is not yet in the schema cache", async () => {
    const { client } = rpcClient({
      claim: { data: null, error: { code: "PGRST202", message: "Could not find the function in the schema cache" } },
    });
    const logger = { log: vi.fn(), warn: vi.fn(), error: vi.fn() };

    const summary = await runDueSiteSearchAgents(client as never, [], { logger });

    expect(summary).toMatchObject({ claimed: 0, completed: 0, blocked: 0, failed: 0, sources: [] });
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining("şeması henüz uygulanmadı"));
  });

  it("finishes a successful run atomically with its lease token and exact request usage", async () => {
    const { client, rpc, finishCalls } = rpcClient();
    mocks.fetchSiteSearchAgentListings.mockImplementation(async (input) => {
      input.onRequestAttempt();
      input.onRequestAttempt();
      return {
        listings: [{ listing_url: "https://mobile.de/vehicle/1" }],
        requestCount: 2,
        queryCount: 1,
        pageCount: 2,
        nextCursor: 4,
        partial: false,
      };
    });
    mocks.processIncomingListings.mockResolvedValue({ fetched: 1, inserted: 1, alertsCreated: 2, alertsSent: 0, alertsFailed: 0 });

    const summary = await runDueSiteSearchAgents(client as never, [], {
      workerId: "fleet-test",
      chefRunId: "00000000-0000-4000-8000-000000000099",
      limit: 1,
    });

    expect(summary).toMatchObject({ claimed: 1, completed: 1, partial: 0, fetched: 1, inserted: 1, alertsCreated: 2 });
    expect(finishCalls).toHaveLength(1);
    expect(rpc).toHaveBeenCalledWith("start_site_search_agent_run", expect.objectContaining({
      p_correlation_id: "00000000-0000-4000-8000-000000000099",
    }));
    expect(finishCalls[0]).toMatchObject({
      p_worker_id: "fleet-test",
      p_lease_token: agent.lease_token,
      p_status: "ok",
      p_request_count: 2,
      p_query_count: 1,
      p_cursor_after: 4,
    });
  });

  it("records provider storage-rights failure through the atomic terminal RPC", async () => {
    const { client, finishCalls } = rpcClient();
    mocks.fetchSiteSearchAgentListings.mockRejectedValue(new Error("Brave Search sonuçlarını saklama hakkı doğrulanmadı"));

    const summary = await runDueSiteSearchAgents(client as never, [], { workerId: "fleet-test" });

    expect(summary).toMatchObject({ claimed: 1, completed: 0, blocked: 1, failed: 0 });
    expect(finishCalls[0]).toMatchObject({
      p_status: "blocked",
      p_error_code: "storage_rights_unverified",
      p_block_agent: true,
    });
  });

  it("keeps a partial provider result and advances only the attempted cursor", async () => {
    const { client, finishCalls } = rpcClient();
    mocks.fetchSiteSearchAgentListings.mockResolvedValue({
      listings: [{ listing_url: "https://mobile.de/vehicle/partial" }],
      requestCount: 1,
      queryCount: 1,
      pageCount: 1,
      nextCursor: 4,
      partial: true,
    });
    mocks.processIncomingListings.mockResolvedValue({ fetched: 1, inserted: 0, alertsCreated: 0, alertsSent: 0, alertsFailed: 0 });

    const summary = await runDueSiteSearchAgents(client as never, [], { workerId: "fleet-test" });

    expect(summary).toMatchObject({ claimed: 1, completed: 1, partial: 1, failed: 0 });
    expect(finishCalls[0]).toMatchObject({ p_status: "partial", p_cursor_after: 4 });
  });

  it("surfaces stale or failed atomic completion instead of reporting false success", async () => {
    const { client } = rpcClient({ finishError: { message: "Stale or invalid site-agent completion." } });
    mocks.fetchSiteSearchAgentListings.mockResolvedValue({
      listings: [], requestCount: 1, queryCount: 1, pageCount: 1, nextCursor: 4, partial: false,
    });
    mocks.processIncomingListings.mockResolvedValue({ fetched: 0, inserted: 0, alertsCreated: 0, alertsSent: 0, alertsFailed: 0 });

    await expect(runDueSiteSearchAgents(client as never, [], { workerId: "fleet-test" }))
      .rejects.toThrow("site_agent_completion_failed");
  });

  it("surfaces unexpected claim failures instead of silently skipping the fleet", async () => {
    const { client } = rpcClient({ claim: { data: null, error: { code: "42501", message: "permission denied" } } });
    await expect(runDueSiteSearchAgents(client as never, [])).rejects.toThrow("site_agent_claim_failed: permission denied");
  });

  it.each([
    ["brave_web: HTTP 429", "provider_rate_limited"],
    ["brave_web: HTTP 401", "provider_authorization_failed"],
    ["request timed out", "provider_timeout"],
    ["site_agent: geçersiz host", "invalid_agent_host"],
    ["network reset", "site_search_failed"],
  ])("classifies %s as %s", (message, expected) => {
    expect(classifySiteAgentError(message)).toBe(expected);
  });
});

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import type { ScannerWatchlist } from "@/lib/scanner/adapters/types";
import { fetchSiteSearchAgentListings } from "@/lib/scanner/adapters/brave-web";
import { processIncomingListings, type ProcessListingsResult } from "@/lib/services/market-alerts";
import { processTransientListings } from "@/lib/services/transient-opportunity";

type Client = SupabaseClient<Database>;
type Agent = Database["public"]["Tables"]["site_search_agents"]["Row"];

export type SiteAgentFleetSummary = {
  claimed: number;
  completed: number;
  partial: number;
  blocked: number;
  failed: number;
  fetched: number;
  inserted: number;
  alertsCreated: number;
  alertsSent: number;
  alertsFailed: number;
  transientCompleted: number;
  persistentCompleted: number;
  sources: Array<{ sourceKey: string; status: "ok" | "partial" | "failed" | "blocked"; errorCode?: string }>;
};

export async function prepareSiteSearchAgentFleet(
  supabase: Client,
  logger: Pick<Console, "warn"> = console,
) {
  const { error: reconcileError } = await supabase.rpc("reconcile_site_search_agent_fleet", {});
  if (reconcileError && !isMissingFleetSchema(reconcileError)) {
    throw new Error(`site_agent_reconcile_failed: ${reconcileError.message}`);
  }
  if (reconcileError) {
    logger.warn("Site-agent katalog uzlaştırması henüz uygulanmadı; mevcut filo kullanılacak");
  }

  if (!process.env.BRAVE_SEARCH_API_KEY) {
    logger.warn("Site-agent filosu etkinleştirilmedi: Brave anahtarı gerekli");
    return false;
  }
  const mode = process.env.BRAVE_SEARCH_MODE === "persistent_search" ? "persistent_search" : "transient_search";
  if (mode === "persistent_search" && process.env.BRAVE_SEARCH_STORAGE_RIGHTS_CONFIRMED !== "true") {
    logger.warn("Persistent site-agent filosu etkinleştirilmedi: Brave saklama hakkı doğrulaması gerekli");
    return false;
  }

  // Activation is an explicit operator action. Never auto-resume paused agents
  // during a scheduled scan or incident-response pauses become ineffective.
  return true;
}

export async function runDueSiteSearchAgents(
  supabase: Client,
  watchlists: ScannerWatchlist[],
  options: { workerId?: string; chefRunId?: string; limit?: number; sourceKey?: string; force?: boolean; logger?: Pick<Console, "log" | "warn" | "error"> } = {},
): Promise<SiteAgentFleetSummary> {
  const logger = options.logger ?? console;
  if (options.limit !== undefined && options.limit !== 1) {
    throw new Error("site_agent_limit_must_equal_one");
  }
  const workerId = options.workerId ?? `site-agent-${crypto.randomUUID()}`;
  const { data, error } = await supabase.rpc("claim_due_site_search_agents", {
    p_worker_id: workerId,
    p_limit: 1,
    p_lease_seconds: 300,
    p_source_key: options.sourceKey ?? null,
    p_force: options.force ?? false,
  });
  if (isMissingFleetSchema(error)) {
    logger.warn("site_search_agents şeması henüz uygulanmadı; site-agent filosu atlandı");
    return createEmptySiteAgentFleetSummary();
  }
  if (error) throw new Error(`site_agent_claim_failed: ${error.message}`);

  const agents = data ?? [];
  const summary = createEmptySiteAgentFleetSummary();
  summary.claimed = agents.length;

  for (const agent of agents) {
    await runAgent(supabase, agent, watchlists, summary, workerId, options.chefRunId, logger);
  }
  return summary;
}

export async function runAllActiveSiteSearchAgents(
  supabase: Client,
  watchlists: ScannerWatchlist[],
  options: { chefRunId: string; logger?: Pick<Console, "log" | "warn" | "error"> },
) {
  const { data: agents, error } = await supabase
    .from("site_search_agents")
    .select("source_key")
    .eq("status", "active")
    .order("source_key");
  if (error) throw new Error(`site_agent_catalog_failed: ${error.message}`);

  const total = createEmptySiteAgentFleetSummary();
  for (const agent of agents ?? []) {
    const result = await runDueSiteSearchAgents(supabase, watchlists, {
      workerId: `manual-europe-${crypto.randomUUID()}`,
      chefRunId: options.chefRunId,
      sourceKey: agent.source_key,
      force: true,
      limit: 1,
      logger: options.logger,
    });
    mergeSiteAgentFleetSummary(total, result);
  }
  return total;
}

export function mergeSiteAgentFleetSummary(target: SiteAgentFleetSummary, source: SiteAgentFleetSummary) {
  target.claimed += source.claimed;
  target.completed += source.completed;
  target.partial += source.partial;
  target.blocked += source.blocked;
  target.failed += source.failed;
  target.fetched += source.fetched;
  target.inserted += source.inserted;
  target.alertsCreated += source.alertsCreated;
  target.alertsSent += source.alertsSent;
  target.alertsFailed += source.alertsFailed;
  target.transientCompleted += source.transientCompleted;
  target.persistentCompleted += source.persistentCompleted;
  target.sources.push(...source.sources);
  return target;
}

export function createEmptySiteAgentFleetSummary(): SiteAgentFleetSummary {
  return {
    claimed: 0,
    completed: 0,
    partial: 0,
    blocked: 0,
    failed: 0,
    fetched: 0,
    inserted: 0,
    alertsCreated: 0,
    alertsSent: 0,
    alertsFailed: 0,
    transientCompleted: 0,
    persistentCompleted: 0,
    sources: [],
  };
}

async function runAgent(
  supabase: Client,
  agent: Agent,
  watchlists: ScannerWatchlist[],
  summary: SiteAgentFleetSummary,
  workerId: string,
  chefRunId: string | undefined,
  logger: Pick<Console, "log" | "warn" | "error">,
) {
  if (!agent.lease_token || agent.reserved_request_count < 1) {
    throw new Error("site_agent_claim_missing_lease_budget");
  }

  // Every child run reports under the correlation ID issued by the Chef Agent.
  const correlationId = chefRunId ?? crypto.randomUUID();
  const { data: runId, error: runError } = await supabase.rpc("start_site_search_agent_run", {
    p_agent_id: agent.id,
    p_worker_id: workerId,
    p_lease_token: agent.lease_token,
    p_correlation_id: correlationId,
  });
  if (runError || !runId) throw new Error(`site_agent_run_registration_failed: ${runError?.message ?? "run id missing"}`);

  logger.log(`[site-agent:${agent.source_key}] ${agent.host} taraması başladı`);
  let requestCount = 0;
  let queryCount = 0;
  let pageCount = 0;
  let cursorAfter = agent.query_cursor;
  let result: ProcessListingsResult | null = null;
  let partial = false;
  const deadlineAt = Date.now() + 200_000;

  try {
    const search = await fetchSiteSearchAgentListings({
      sourceKey: agent.source_key,
      host: agent.host,
      watchlists,
      queryCursor: agent.query_cursor,
      maxQueries: agent.max_queries_per_run,
      maxPages: agent.max_pages_per_query,
      maxRequests: agent.reserved_request_count,
      onRequestAttempt: () => { requestCount += 1; },
      processingMode: agent.processing_mode,
    });
    requestCount = Math.max(requestCount, search.requestCount);
    queryCount = search.queryCount;
    pageCount = search.pageCount;
    cursorAfter = search.nextCursor;
    partial = search.partial;
    result = agent.processing_mode === "transient_search"
      ? await processTransientListings(supabase, search.listings, watchlists)
      : await processIncomingListings(supabase, search.listings, { deadlineAt });
    if ((result.rejected ?? 0) > 0 || (result.deferred ?? 0) > 0) partial = true;
    if ((result.deferred ?? 0) > 0) cursorAfter = agent.query_cursor;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Bilinmeyen site-agent hatası";
    const errorCode = classifySiteAgentError(message);
    const blocked = errorCode === "storage_rights_unverified" || errorCode === "provider_authorization_failed";
    const failureStatus = blocked ? "blocked" as const : "failed" as const;
    const nextFailureCount = agent.consecutive_failures + 1;

    try {
      await finishRun(supabase, {
        runId,
        agent,
        workerId,
        status: failureStatus,
        requestCount,
        queryCount,
        pageCount,
        fetched: 0,
        inserted: 0,
        alertsCreated: 0,
        cursorAfter: agent.query_cursor,
        nextRunAt: failureRetryAt(agent, new Date(), nextFailureCount),
        errorCode,
        errorMessage: sanitizeError(message),
        blockAgent: blocked,
      });
    } catch (completionError) {
      logger.error(`[site-agent:${agent.source_key}] original=${sanitizeError(message)}; completion=${sanitizeError(completionError instanceof Error ? completionError.message : "unknown")}`);
    }

    if (blocked) summary.blocked += 1;
    else summary.failed += 1;
    summary.sources.push({ sourceKey: agent.source_key, status: failureStatus, errorCode });
    logger.error(`[site-agent:${agent.source_key}] ${errorCode}: ${sanitizeError(message)}`);
    return;
  }

  const status = partial ? "partial" as const : "ok" as const;
  await finishRun(supabase, {
    runId,
    agent,
    workerId,
    status,
    requestCount,
    queryCount,
    pageCount,
    fetched: result.fetched,
    inserted: result.inserted,
    alertsCreated: result.alertsCreated,
    cursorAfter,
    nextRunAt: nextRunAt(agent, new Date()),
    errorCode: null,
    errorMessage: null,
    blockAgent: false,
  });

  summary.completed += 1;
  if (partial) summary.partial += 1;
  summary.fetched += result.fetched;
  summary.inserted += result.inserted;
  summary.alertsCreated += result.alertsCreated;
  summary.alertsSent += result.alertsSent;
  summary.alertsFailed += result.alertsFailed;
  if (agent.processing_mode === "transient_search") summary.transientCompleted += 1;
  else summary.persistentCompleted += 1;
  summary.sources.push({ sourceKey: agent.source_key, status });
  logger.log(`[site-agent:${agent.source_key}] ${result.fetched} sonuç, ${result.inserted} yeni kayıt`);
}

async function finishRun(
  supabase: Client,
  input: {
    runId: string;
    agent: Agent;
    workerId: string;
    status: "ok" | "partial" | "failed" | "blocked";
    requestCount: number;
    queryCount: number;
    pageCount: number;
    fetched: number;
    inserted: number;
    alertsCreated: number;
    cursorAfter: number;
    nextRunAt: string;
    errorCode: string | null;
    errorMessage: string | null;
    blockAgent: boolean;
  },
) {
  const { error } = await supabase.rpc("finish_site_search_agent_run", {
    p_run_id: input.runId,
    p_agent_id: input.agent.id,
    p_worker_id: input.workerId,
    p_lease_token: input.agent.lease_token!,
    p_status: input.status,
    p_request_count: input.requestCount,
    p_query_count: input.queryCount,
    p_page_count: input.pageCount,
    p_fetched_count: input.fetched,
    p_inserted_count: input.inserted,
    p_alerts_created: input.alertsCreated,
    p_cursor_after: input.cursorAfter,
    p_next_run_at: input.nextRunAt,
    p_error_code: input.errorCode,
    p_error_message: input.errorMessage,
    p_block_agent: input.blockAgent,
  });
  if (error) throw new Error(`site_agent_completion_failed: ${error.message}`);
}

function nextRunAt(agent: Agent, from: Date) {
  const spread = agent.interval_minutes * (agent.jitter_percent / 100);
  const minutes = agent.interval_minutes + (Math.random() * spread * 2 - spread);
  return new Date(from.getTime() + Math.max(15, minutes) * 60_000).toISOString();
}

function failureRetryAt(agent: Agent, from: Date, failures: number) {
  const base = Math.max(15, Math.min(agent.interval_minutes, 120));
  const minutes = Math.min(24 * 60, base * (2 ** Math.min(failures - 1, 6)));
  return new Date(from.getTime() + minutes * 60_000).toISOString();
}

export function classifySiteAgentError(message: string) {
  if (/storage.*right|saklama hakkı/i.test(message)) return "storage_rights_unverified";
  if (/HTTP 429|rate.?limit/i.test(message)) return "provider_rate_limited";
  if (/HTTP 401|HTTP 403|API_KEY/i.test(message)) return "provider_authorization_failed";
  if (/timeout|timed out|abort/i.test(message)) return "provider_timeout";
  if (/invalid.*host|geçersiz host/i.test(message)) return "invalid_agent_host";
  return "site_search_failed";
}

function sanitizeError(value: string) {
  return value.replace(/[A-Za-z0-9_-]{32,}/g, "<redacted>").slice(0, 1000);
}

function isMissingFleetSchema(error: { code?: string; message: string } | null) {
  return Boolean(error && (error.code === "PGRST202" || error.code === "42883" || /schema cache|does not exist/i.test(error.message)));
}

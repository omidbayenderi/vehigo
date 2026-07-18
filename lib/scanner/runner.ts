import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import {
  listActiveWatchlistsForScanner,
  listDueScannerSources,
  markStaleListingsAsDelisted,
  processIncomingListings,
  recordScannerRun,
} from "@/lib/services/market-alerts";
import { getConnector } from "@/lib/scanner/registry";
import { syncRuntimeConnectorCatalog } from "@/lib/services/source-catalog";
import { replayDueIngestEvents } from "@/lib/services/scanner-ingest";
import {
  createEmptySiteAgentFleetSummary,
  mergeSiteAgentFleetSummary,
  prepareSiteSearchAgentFleet,
  runAllActiveSiteSearchAgents,
  runDueSiteSearchAgents,
  type SiteAgentFleetSummary,
} from "@/lib/scanner/site-search-agents";
import { processTransientListings } from "@/lib/services/transient-opportunity";

type Client = SupabaseClient<Database>;

// The route that calls runScannerOnce caps at maxDuration=240s (see
// app/api/scanner/run/route.ts). A single site-search-agent claim used to
// stop the loop after one agent, so a fleet of dozens of agents could only
// be worked through as fast as the external cron happened to fire — and
// schedule delivery for infrequent-activity repos is unreliable. Instead,
// keep claiming and running due agents until the fleet is drained or the
// time budget runs out, so one invocation clears as much of the backlog as
// it safely can.
const SITE_AGENT_LOOP_BUDGET_MS = 180_000;
const SITE_AGENT_LOOP_MAX_CLAIMS = 60;

export type ScannerRunOptions = {
  force?: boolean;
  sourceKey?: string;
  siteAgentScope?: "one" | "all";
  logger?: Pick<Console, "log" | "warn" | "error">;
};

export type ScannerRunSummary = {
  checkedSources: number;
  scannedSources: number;
  persistentScannedSources: number;
  fetched: number;
  inserted: number;
  alertsCreated: number;
  alertsSent: number;
  alertsFailed: number;
  delisted: number;
  ingestReplayed: number;
  ingestReplayFailed: number;
  expiredPayloadsPurged: number;
  maintenanceFailed: boolean;
  siteAgents: SiteAgentFleetSummary;
  skipped: string[];
  failed: { sourceKey: string; error: string }[];
};

export async function runScannerOnce(
  supabase: Client,
  options: ScannerRunOptions = {},
): Promise<ScannerRunSummary> {
  const logger = options.logger ?? console;
  const chefRunId = crypto.randomUUID();
  logger.log(`[chef-agent:${chefRunId}] kaynak uzlaştırması ve görev dağıtımı başladı`);
  await syncRuntimeConnectorCatalog(supabase);
  const siteAgentFleetReady = await prepareSiteSearchAgentFleet(supabase, logger);
  const [{ replayed, failed: replayFailed }, { data: purgedPayloads, error: purgeError }] = await Promise.all([
    replayDueIngestEvents(supabase),
    supabase.rpc("purge_expired_scanner_ingest_payloads", {}),
  ]);
  if (purgeError) logger.warn(`Süresi dolan ingest payload'ları temizlenemedi: ${purgeError.message}`);
  const dueSources = await listDueScannerSources(supabase, {
    force: options.force,
    sourceKey: options.sourceKey,
    workerId: crypto.randomUUID(),
  });
  const watchlists = await listActiveWatchlistsForScanner(supabase);

  const summary: ScannerRunSummary = {
    checkedSources: dueSources.length,
    scannedSources: 0,
    persistentScannedSources: 0,
    fetched: 0,
    inserted: 0,
    alertsCreated: 0,
    alertsSent: 0,
    alertsFailed: 0,
    delisted: 0,
    ingestReplayed: replayed,
    ingestReplayFailed: replayFailed,
    expiredPayloadsPurged: purgeError ? 0 : (purgedPayloads ?? 0),
    maintenanceFailed: Boolean(purgeError),
    siteAgents: createEmptySiteAgentFleetSummary(),
    skipped: [],
    failed: [],
  };

  for (const source of dueSources) {
    const startedAt = new Date();

    if (source.key === "brave_web" && !siteAgentFleetReady) {
      logger.warn("[brave_web] sonuç saklama hakkı doğrulanmadığı için tarama güvenli biçimde atlandı");
      summary.skipped.push(source.key);
      await recordScannerRun(supabase, source.key, startedAt, {
        status: "skipped",
        error: "Brave Search storage rights are not verified",
      });
      continue;
    }

    const adapter = getConnector(source.key);
    if (!adapter) {
      logger.warn(`[${source.key}] adaptör yok, atlanıyor`);
      summary.skipped.push(source.key);
      await recordScannerRun(supabase, source.key, startedAt, {
        status: "skipped",
        error: "Adaptör tanımlı değil",
      });
      continue;
    }

    logger.log(`[${source.key}] tarama başladı...`);
    try {
      const listings = await adapter.fetchListings({ watchlists });
      const result = adapter.processingMode === "transient"
        ? await processTransientListings(supabase, listings, watchlists)
        : await processIncomingListings(supabase, listings);
      const { nextRunAt } = await recordScannerRun(supabase, source.key, startedAt, {
        status: "ok",
        result,
      });

      summary.scannedSources++;
      if (adapter.processingMode !== "transient") summary.persistentScannedSources++;
      summary.fetched += result.fetched;
      summary.inserted += result.inserted;
      summary.alertsCreated += result.alertsCreated;
      summary.alertsSent += result.alertsSent;
      summary.alertsFailed += result.alertsFailed;

      logger.log(
        `[${source.key}] tamamlandı: ${result.fetched} çekildi, ${result.inserted} yeni, ` +
          `${result.alertsCreated} alarm oluşturuldu, ${result.alertsSent} Telegram'a gönderildi. ` +
          `Sonraki tarama: ${nextRunAt}`,
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : "Bilinmeyen hata";
      logger.error(`[${source.key}] HATA: ${message}`);
      summary.failed.push({ sourceKey: source.key, error: message });
      await recordScannerRun(supabase, source.key, startedAt, { status: "failed", error: message });
    }
  }

  try {
    if (!siteAgentFleetReady) {
      logger.log(`[chef-agent:${chefRunId}] filo güvenlik nedeniyle çalıştırılmadı; durum raporu tamamlandı`);
      return finalizeScannerRun(supabase, summary);
    }
    if (options.siteAgentScope === "all") {
      summary.siteAgents = await runAllActiveSiteSearchAgents(supabase, watchlists, { chefRunId, logger });
    } else {
      // A caller targeting one source (e.g. an admin re-running a single
      // connector) wants exactly that one claim, not a repeated sweep of the
      // same source. Only the unscoped sweep — the routine cron path — drains
      // the due backlog across multiple claims.
      const maxClaims = options.sourceKey ? 1 : SITE_AGENT_LOOP_MAX_CLAIMS;
      const loopDeadlineAt = Date.now() + SITE_AGENT_LOOP_BUDGET_MS;
      for (let claims = 0; claims < maxClaims && Date.now() < loopDeadlineAt; claims += 1) {
        const result = await runDueSiteSearchAgents(supabase, watchlists, {
          workerId: `scanner-${crypto.randomUUID()}`,
          chefRunId,
          limit: 1,
          sourceKey: options.sourceKey,
          force: options.force,
          logger,
        });
        mergeSiteAgentFleetSummary(summary.siteAgents, result);
        if (result.claimed === 0) break;
      }
    }
    summary.fetched += summary.siteAgents.fetched;
    summary.inserted += summary.siteAgents.inserted;
    summary.alertsCreated += summary.siteAgents.alertsCreated;
    summary.alertsSent += summary.siteAgents.alertsSent;
    summary.alertsFailed += summary.siteAgents.alertsFailed;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Bilinmeyen site-agent filo hatası";
    logger.error(`[site-agent-fleet] HATA: ${message}`);
    summary.failed.push({ sourceKey: "site_agent_fleet", error: message });
  }

  logger.log(`[chef-agent:${chefRunId}] ajan raporları toplandı`);
  return finalizeScannerRun(supabase, summary);
}

async function finalizeScannerRun(supabase: Client, summary: ScannerRunSummary) {
  const persistentDiscoveryRan = summary.persistentScannedSources > 0 || summary.siteAgents.persistentCompleted > 0;
  summary.delisted = persistentDiscoveryRan ? await markStaleListingsAsDelisted(supabase) : 0;
  return summary;
}

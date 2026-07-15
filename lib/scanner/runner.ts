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
  prepareSiteSearchAgentFleet,
  runDueSiteSearchAgents,
  type SiteAgentFleetSummary,
} from "@/lib/scanner/site-search-agents";

type Client = SupabaseClient<Database>;

export type ScannerRunOptions = {
  force?: boolean;
  sourceKey?: string;
  logger?: Pick<Console, "log" | "warn" | "error">;
};

export type ScannerRunSummary = {
  checkedSources: number;
  scannedSources: number;
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
      const result = await processIncomingListings(supabase, listings);
      const { nextRunAt } = await recordScannerRun(supabase, source.key, startedAt, {
        status: "ok",
        result,
      });

      summary.scannedSources++;
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
    if (!siteAgentFleetReady) return finalizeScannerRun(supabase, summary);
    summary.siteAgents = await runDueSiteSearchAgents(supabase, watchlists, {
      workerId: `scanner-${crypto.randomUUID()}`,
      limit: 1,
      sourceKey: options.sourceKey,
      logger,
    });
    summary.fetched += summary.siteAgents.fetched;
    summary.inserted += summary.siteAgents.inserted;
    summary.alertsCreated += summary.siteAgents.alertsCreated;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Bilinmeyen site-agent filo hatası";
    logger.error(`[site-agent-fleet] HATA: ${message}`);
    summary.failed.push({ sourceKey: "site_agent_fleet", error: message });
  }

  return finalizeScannerRun(supabase, summary);
}

async function finalizeScannerRun(supabase: Client, summary: ScannerRunSummary) {
  summary.delisted = await markStaleListingsAsDelisted(supabase);
  return summary;
}

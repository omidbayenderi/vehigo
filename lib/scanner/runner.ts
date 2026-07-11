import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import {
  listActiveWatchlistsForScanner,
  listDueScannerSources,
  markStaleListingsAsDelisted,
  processIncomingListings,
  recordScannerRun,
} from "@/lib/services/market-alerts";
import { braveWebAdapter } from "@/lib/scanner/adapters/brave-web";
import { marktplaatsAdapter } from "@/lib/scanner/adapters/marktplaats";
import type { ScanAdapter } from "@/lib/scanner/adapters/types";

type Client = SupabaseClient<Database>;

const ADAPTERS: Record<string, ScanAdapter> = {
  [marktplaatsAdapter.key]: marktplaatsAdapter,
  [braveWebAdapter.key]: braveWebAdapter,
};

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
  skipped: string[];
  failed: { sourceKey: string; error: string }[];
};

export async function runScannerOnce(
  supabase: Client,
  options: ScannerRunOptions = {},
): Promise<ScannerRunSummary> {
  const logger = options.logger ?? console;
  const dueSources = (await listDueScannerSources(supabase, { force: options.force })).filter((source) =>
    options.sourceKey ? source.key === options.sourceKey : true,
  );
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
    skipped: [],
    failed: [],
  };

  for (const source of dueSources) {
    const adapter = ADAPTERS[source.key];
    const startedAt = new Date();

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

  summary.delisted = await markStaleListingsAsDelisted(supabase);

  return summary;
}

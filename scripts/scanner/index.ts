import path from "node:path";
import process from "node:process";
import { createAdminClient } from "../../lib/supabase/admin";
import {
  listDueScrapeSources,
  processIncomingListings,
  recordScannerRun,
} from "../../lib/services/market-alerts";
import { marktplaatsAdapter } from "./adapters/marktplaats";
import type { ScanAdapter } from "./adapters/types";

process.loadEnvFile(path.join(process.cwd(), ".env.local"));

const ADAPTERS: Record<string, ScanAdapter> = {
  [marktplaatsAdapter.key]: marktplaatsAdapter,
};

const CHECK_INTERVAL_MS = 2 * 60 * 1000;

async function runDueSources() {
  const supabase = createAdminClient();
  const dueSources = await listDueScrapeSources(supabase);

  if (dueSources.length === 0) {
    console.log(`[${new Date().toISOString()}] taranacak kaynak yok, bekleniyor...`);
    return;
  }

  for (const source of dueSources) {
    const adapter = ADAPTERS[source.key];
    const startedAt = new Date();

    if (!adapter) {
      console.warn(`[${source.key}] adaptör yok, atlanıyor`);
      await recordScannerRun(supabase, source.key, startedAt, {
        status: "skipped",
        error: "Adaptör tanımlı değil",
      });
      continue;
    }

    console.log(`[${source.key}] tarama başladı...`);
    try {
      const listings = await adapter.fetchListings();
      const result = await processIncomingListings(supabase, listings);
      const { nextRunAt } = await recordScannerRun(supabase, source.key, startedAt, {
        status: "ok",
        result,
      });
      console.log(
        `[${source.key}] tamamlandı: ${result.fetched} çekildi, ${result.inserted} yeni, ` +
          `${result.alertsCreated} alarm oluşturuldu, ${result.alertsSent} Telegram'a gönderildi. ` +
          `Sonraki tarama: ${nextRunAt}`,
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : "Bilinmeyen hata";
      console.error(`[${source.key}] HATA: ${message}`);
      await recordScannerRun(supabase, source.key, startedAt, { status: "failed", error: message });
    }
  }
}

async function main() {
  const once = process.argv.includes("--once");

  await runDueSources();
  if (once) return;

  console.log(`Sürekli mod: her ${CHECK_INTERVAL_MS / 60_000} dakikada bir due kaynaklar kontrol edilecek.`);
  setInterval(() => {
    runDueSources().catch((err) => console.error("Tarama döngüsü hatası:", err));
  }, CHECK_INTERVAL_MS);
}

main().catch((err) => {
  console.error("Scanner başlatılamadı:", err);
  process.exit(1);
});

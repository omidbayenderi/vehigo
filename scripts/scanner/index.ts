import path from "node:path";
import process from "node:process";
import { createAdminClient } from "../../lib/supabase/admin";
import { runScannerOnce } from "../../lib/scanner/runner";

process.loadEnvFile(path.join(process.cwd(), ".env.local"));

const CHECK_INTERVAL_MS = 2 * 60 * 1000;

async function runDueSources() {
  const supabase = createAdminClient();
  const force = process.argv.includes("--force");
  const sourceArg = process.argv.find((arg) => arg.startsWith("--source="));
  const sourceKey = sourceArg?.slice("--source=".length);
  const summary = await runScannerOnce(supabase, { force, sourceKey });

  if (summary.checkedSources === 0) {
    console.log(`[${new Date().toISOString()}] taranacak kaynak yok, bekleniyor...`);
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

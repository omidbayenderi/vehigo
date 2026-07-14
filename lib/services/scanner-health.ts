import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { getConnector } from "@/lib/scanner/registry";
import { connectorContractIssues } from "@/lib/services/source-catalog";

type Client = SupabaseClient<Database>;

export type ScannerHealthIssue = {
  sourceKey: string;
  sourceName: string;
  kind: "never_ran" | "stale" | "failing" | "missing_connector" | "contract_mismatch" | "dead_letter_backlog";
  detail: string;
};

export async function checkScannerHealth(supabase: Client): Promise<ScannerHealthIssue[]> {
  const { data: sources, error: sourcesError } = await supabase
    .from("market_sources")
    .select("key,name,min_interval_minutes,connector_version,acquisition_modes,country_codes,vehicle_types")
    .eq("enabled", true)
    .in("method", ["scrape", "web_search"]);
  if (sourcesError) throw new Error(sourcesError.message);
  if (!sources || sources.length === 0) return [];

  const issues: ScannerHealthIssue[] = [];

  for (const source of sources) {
    const connector = getConnector(source.key);
    if (!connector) {
      issues.push({
        sourceKey: source.key,
        sourceName: source.name,
        kind: "missing_connector",
        detail: "Aktif runtime kaynağı için connector bulunamadı",
      });
    } else {
      const contractIssues = connectorContractIssues(source, connector.manifest);
      if (contractIssues.length > 0) {
        issues.push({
          sourceKey: source.key,
          sourceName: source.name,
          kind: "contract_mismatch",
          detail: `Connector manifest uyuşmazlığı: ${contractIssues.join(", ")}`,
        });
      }
    }

    const { data: lastRun, error: runError } = await supabase
      .from("scanner_runs")
      .select("started_at,status,error")
      .eq("source_key", source.key)
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (runError) throw new Error(runError.message);

    if (!lastRun) {
      issues.push({
        sourceKey: source.key,
        sourceName: source.name,
        kind: "never_ran",
        detail: "Hiç çalışmadı",
      });
      continue;
    }

    const thresholdMinutes = source.min_interval_minutes * 2 + 60;
    const ageMinutes = (Date.now() - new Date(lastRun.started_at).getTime()) / 60_000;

    if (ageMinutes > thresholdMinutes) {
      const ageHours = Math.round(ageMinutes / 60);
      issues.push({
        sourceKey: source.key,
        sourceName: source.name,
        kind: "stale",
        detail: `Son çalışma ${ageHours} saat önce (beklenen aralık aşıldı)`,
      });
    } else if (lastRun.status === "failed") {
      issues.push({
        sourceKey: source.key,
        sourceName: source.name,
        kind: "failing",
        detail: lastRun.error ? `Son çalışma başarısız: ${lastRun.error}` : "Son çalışma başarısız",
      });
    }
  }

  const { count: failedIngestCount, error: ingestError } = await supabase
    .from("scanner_ingest_events")
    .select("id", { count: "exact", head: true })
    .eq("status", "failed")
    .lt("attempt_count", 5);
  if (ingestError) throw new Error(ingestError.message);
  if ((failedIngestCount ?? 0) > 0) {
    issues.push({
      sourceKey: "ingest",
      sourceName: "Ingest dead-letter kuyruğu",
      kind: "dead_letter_backlog",
      detail: `${failedIngestCount} yeniden oynatılabilir başarısız event bekliyor`,
    });
  }

  return issues;
}

export function formatScannerHealthWarning(issues: ScannerHealthIssue[]): string {
  const lines = [
    `⚠️ Tarayıcı sağlık uyarısı`,
    ``,
    ...issues.map((issue) => `- ${issue.sourceName}: ${issue.detail}`),
  ];
  return lines.join("\n");
}

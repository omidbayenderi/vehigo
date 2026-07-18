import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { getConnector } from "@/lib/scanner/registry";
import { connectorContractIssues } from "@/lib/services/source-catalog";

type Client = SupabaseClient<Database>;

export type ScannerHealthIssue = {
  sourceKey: string;
  sourceName: string;
  kind: "never_ran" | "stale" | "failing" | "empty_results" | "missing_connector" | "contract_mismatch" | "dead_letter_backlog";
  detail: string;
};

export async function checkScannerHealth(supabase: Client): Promise<ScannerHealthIssue[]> {
  const { data: sources, error: sourcesError } = await supabase
    .from("market_sources")
    .select("key,name,min_interval_minutes,connector_version,acquisition_modes,country_codes,vehicle_types,persistence_policy")
    .eq("enabled", true)
    .in("method", ["scrape", "web_search", "api"]);
  if (sourcesError) throw new Error(sourcesError.message);
  const issues: ScannerHealthIssue[] = [];

  for (const source of sources ?? []) {
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

    const { data: recentRuns, error: runError } = await supabase
      .from("scanner_runs")
      .select("started_at,status,error,fetched_count")
      .eq("source_key", source.key)
      .order("started_at", { ascending: false })
      .limit(3);
    if (runError) throw new Error(runError.message);
    const lastRun = recentRuns?.[0];

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
    } else if (recentRuns.length >= 3 && recentRuns.every((run) => run.status === "ok" && run.fetched_count === 0)) {
      issues.push({
        sourceKey: source.key,
        sourceName: source.name,
        kind: "empty_results",
        detail: "Son 3 başarılı tarama sıfır sonuç döndürdü; actor/sorgu sözleşmesi kontrol edilmeli",
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

  const { data: siteAgents, error: agentsError } = await supabase
    .from("site_search_agents")
    .select("status,last_started_at,last_status,last_error_message,interval_minutes");
  if (agentsError && !/schema cache|does not exist/i.test(agentsError.message)) {
    throw new Error(agentsError.message);
  }
  if (siteAgents) {
    const pending = siteAgents.filter((agent) => agent.status === "pending_activation").length;
    const blocked = siteAgents.filter((agent) => agent.status === "blocked").length;
    const now = Date.now();
    const stale = siteAgents.filter((agent) => agent.status === "active" && (
      !agent.last_started_at
      || now - new Date(agent.last_started_at).getTime() > (agent.interval_minutes * 2 + 60) * 60_000
    )).length;
    const failing = siteAgents.filter((agent) => agent.status === "active" && agent.last_status === "failed").length;

    if (pending > 0) {
      issues.push({
        sourceKey: "site_agent_fleet",
        sourceName: "Pazar ajan filosu",
        kind: "never_ran",
        detail: `${pending} bağımsız ajan aktivasyon bekliyor`,
      });
    }
    if (blocked > 0) {
      issues.push({
        sourceKey: "site_agent_fleet",
        sourceName: "Pazar ajan filosu",
        kind: "failing",
        detail: `${blocked} bağımsız ajan engellendi`,
      });
    }
    if (stale > 0) {
      issues.push({
        sourceKey: "site_agent_fleet",
        sourceName: "Pazar ajan filosu",
        kind: "stale",
        detail: `${stale} bağımsız ajan beklenen çalışma aralığını aştı`,
      });
    }
    if (failing > 0) {
      issues.push({
        sourceKey: "site_agent_fleet",
        sourceName: "Pazar ajan filosu",
        kind: "failing",
        detail: `${failing} bağımsız ajanın son çalışması başarısız`,
      });
    }
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

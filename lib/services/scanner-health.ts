import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { getConnector } from "@/lib/scanner/registry";
import { connectorContractIssues } from "@/lib/services/source-catalog";

type Client = SupabaseClient<Database>;

export type ScannerHealthIssue = {
  sourceKey: string;
  sourceName: string;
  kind: "never_ran" | "stale" | "failing" | "recovering" | "empty_results" | "missing_connector" | "contract_mismatch" | "dead_letter_backlog";
  severity: "warning" | "critical";
  detail: string;
};

export type ScannerActivitySummary = {
  status: "active" | "idle" | "failing";
  lastStartedAt: string | null;
  lastCompletedAt: string | null;
  lastSuccessAt: string | null;
  nextRunAt: string | null;
  fetched: number;
  alertsCreated: number;
  errorCode: string | null;
};

export async function getScannerActivitySummary(supabase: Client): Promise<ScannerActivitySummary> {
  const { data: agent, error: agentError } = await supabase
    .from("site_search_agents")
    .select("source_key,status,last_status,last_error_code,last_started_at,last_completed_at,last_success_at,next_run_at")
    .eq("status", "active")
    .order("last_started_at", { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();
  if (agentError) throw new Error(agentError.message);
  if (!agent) {
    return { status: "idle", lastStartedAt: null, lastCompletedAt: null, lastSuccessAt: null, nextRunAt: null, fetched: 0, alertsCreated: 0, errorCode: null };
  }
  const { data: run, error: runError } = await supabase
    .from("site_search_agent_runs")
    .select("fetched_count,alerts_created")
    .eq("source_key", agent.source_key)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (runError) throw new Error(runError.message);
  return {
    status: agent.last_status === "failed" || agent.last_status === "blocked" ? "failing" : "active",
    lastStartedAt: agent.last_started_at,
    lastCompletedAt: agent.last_completed_at,
    lastSuccessAt: agent.last_success_at,
    nextRunAt: agent.next_run_at,
    fetched: run?.fetched_count ?? 0,
    alertsCreated: run?.alerts_created ?? 0,
    errorCode: agent.last_error_code,
  };
}

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
        severity: "critical",
        detail: "Aktif runtime kaynağı için connector bulunamadı",
      });
    } else {
      const contractIssues = connectorContractIssues(source, connector.manifest);
      if (contractIssues.length > 0) {
        issues.push({
          sourceKey: source.key,
          sourceName: source.name,
          kind: "contract_mismatch",
          severity: "critical",
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
        severity: "critical",
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
        severity: "critical",
        detail: `Son çalışma ${ageHours} saat önce (beklenen aralık aşıldı)`,
      });
    } else if (lastRun.status === "failed") {
      issues.push({
        sourceKey: source.key,
        sourceName: source.name,
        kind: "failing",
        severity: "critical",
        detail: lastRun.error ? `Son çalışma başarısız: ${lastRun.error}` : "Son çalışma başarısız",
      });
    } else if (recentRuns.length >= 3 && recentRuns.every((run) => run.status === "ok" && run.fetched_count === 0)) {
      issues.push({
        sourceKey: source.key,
        sourceName: source.name,
        kind: "empty_results",
        severity: "warning",
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
      severity: "critical",
      detail: `${failedIngestCount} yeniden oynatılabilir başarısız event bekliyor`,
    });
  }

  const { data: siteAgents, error: agentsError } = await supabase
    .from("site_search_agents")
    .select("status,last_started_at,last_status,last_error_code,last_error_message,consecutive_failures,next_run_at,interval_minutes");
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
    const failedAgents = siteAgents.filter((agent) => agent.status === "active" && agent.last_status === "failed");
    const recovering = failedAgents.filter((agent) => agent.consecutive_failures < 2);
    const failing = failedAgents.filter((agent) => agent.consecutive_failures >= 2);

    if (pending > 0) {
      issues.push({
        sourceKey: "site_agent_fleet",
        sourceName: "Europe Web Scout",
        kind: "never_ran",
        severity: "critical",
        detail: `${pending} birleşik agent aktivasyon bekliyor`,
      });
    }
    if (blocked > 0) {
      issues.push({
        sourceKey: "site_agent_fleet",
        sourceName: "Europe Web Scout",
        kind: "failing",
        severity: "critical",
        detail: `${blocked} birleşik agent engellendi`,
      });
    }
    if (stale > 0) {
      issues.push({
        sourceKey: "site_agent_fleet",
        sourceName: "Europe Web Scout",
        kind: "stale",
        severity: "critical",
        detail: `${stale} birleşik agent beklenen çalışma aralığını aştı`,
      });
    }
    if (recovering.length > 0) {
      issues.push({
        sourceKey: "site_agent_fleet",
        sourceName: "Europe Web Scout",
        kind: "recovering",
        severity: "warning",
        detail: describeAgentFailure(recovering[0], "Geçici tarama hatası; otomatik tekrar denenecek"),
      });
    }
    if (failing.length > 0) {
      issues.push({
        sourceKey: "site_agent_fleet",
        sourceName: "Europe Web Scout",
        kind: "failing",
        severity: "critical",
        detail: describeAgentFailure(failing[0], `${failing.length} ardışık birleşik agent çalışması başarısız`),
      });
    }
  }

  return issues;
}

export function criticalScannerHealthIssues(issues: ScannerHealthIssue[]) {
  return issues.filter((issue) => issue.severity === "critical");
}

function describeAgentFailure(
  agent: { last_error_code: string | null; last_error_message: string | null; next_run_at: string | null },
  prefix: string,
) {
  const code = agent.last_error_code ? errorCodeLabel(agent.last_error_code) : null;
  const safeMessage = agent.last_error_message?.replace(/[A-Za-z0-9_-]{32,}/g, "<redacted>").slice(0, 180);
  const retry = agent.next_run_at ? `Tekrar: ${new Date(agent.next_run_at).toLocaleString("tr-TR")}` : null;
  return [prefix, code, safeMessage, retry].filter(Boolean).join(" · ");
}

function errorCodeLabel(code: string) {
  const labels: Record<string, string> = {
    provider_rate_limited: "Sağlayıcı hız limiti",
    provider_payment_required: "Sağlayıcı kredisi/ödemesi gerekli",
    provider_timeout: "Sağlayıcı zaman aşımı",
    provider_authorization_failed: "Sağlayıcı yetkilendirme hatası",
    storage_rights_unverified: "Veri saklama hakkı doğrulanmadı",
    invalid_agent_host: "Geçersiz agent hostu",
    site_search_failed: "Arama sağlayıcısı hatası",
  };
  return labels[code] ?? code;
}

export function formatScannerHealthWarning(issues: ScannerHealthIssue[]): string {
  const lines = [
    `⚠️ Tarayıcı sağlık uyarısı`,
    ``,
    ...issues.map((issue) => `- ${issue.sourceName}: ${issue.detail}`),
  ];
  return lines.join("\n");
}

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, OfferStatus } from "@/lib/supabase/types";
import { checkScannerHealth } from "@/lib/services/scanner-health";

type Client = SupabaseClient<Database>;

const CLOSED_LEAD_STATUSES = ["closed_won", "closed_lost"];
const OPEN_OFFER_STATUSES: OfferStatus[] = ["draft", "sent"];

export type MoneyTotal = { currency: string; amount: number };

type RuntimeSource = { key: string };
type SiteSearchAgentMetric = {
  source_key: string;
  status: string;
  last_success_at: string | null;
};
type ScannerRunMetric = {
  new_count?: number | null;
  alert_count?: number | null;
  started_at?: string;
  finished_at?: string | null;
};
type SiteSearchRunMetric = {
  inserted_count: number | null;
  alerts_created: number | null;
};

export type DashboardMetrics = {
  activeLeadCount: number;
  openOfferCount: number;
  expectedCommissionTotals: MoneyTotal[];
  totalVehicleCount: number;
  availableVehicleCount: number;
  leadsByStatus: Record<string, number>;
  newOpportunityCount: number;
  shortlistedOpportunityCount: number;
  scannerHealthIssueCount: number;
  activeSourceCount: number;
  healthySourceCount: number;
  listingsDiscovered24h: number;
  alertsCreated24h: number;
  telegramFailureCount: number;
  lastSuccessfulScanAt: string | null;
  telegramReady: boolean;
  measuredAt: string;
};

export function combineScannerMetrics({
  runtimeSources,
  siteAgents,
  scannerRuns,
  siteAgentRuns,
  lastScannerRun,
  scannerHealthIssueCount,
}: {
  runtimeSources: RuntimeSource[];
  siteAgents: SiteSearchAgentMetric[];
  scannerRuns: ScannerRunMetric[];
  siteAgentRuns: SiteSearchRunMetric[];
  lastScannerRun: ScannerRunMetric | null;
  scannerHealthIssueCount: number;
}) {
  const activeSourceKeys = new Set(runtimeSources.map((source) => source.key));
  for (const agent of siteAgents) {
    if (agent.status === "active") activeSourceKeys.add(agent.source_key);
  }

  const successfulTimestamps = [
    lastScannerRun?.finished_at ?? lastScannerRun?.started_at ?? null,
    ...siteAgents.map((agent) => agent.last_success_at),
  ].filter((value): value is string => Boolean(value));
  const lastSuccessfulScanAt = successfulTimestamps.sort(
    (a, b) => new Date(b).getTime() - new Date(a).getTime(),
  )[0] ?? null;

  const listingsDiscovered24h = scannerRuns.reduce((sum, run) => sum + (run.new_count ?? 0), 0)
    + siteAgentRuns.reduce((sum, run) => sum + (run.inserted_count ?? 0), 0);
  const alertsCreated24h = scannerRuns.reduce((sum, run) => sum + (run.alert_count ?? 0), 0)
    + siteAgentRuns.reduce((sum, run) => sum + (run.alerts_created ?? 0), 0);
  const activeSourceCount = activeSourceKeys.size;

  return {
    activeSourceCount,
    healthySourceCount: Math.max(0, activeSourceCount - scannerHealthIssueCount),
    listingsDiscovered24h,
    alertsCreated24h,
    lastSuccessfulScanAt,
  };
}

export function groupMoneyByCurrency(
  rows: Array<{ amount: number | null; currency: string | null }>,
): MoneyTotal[] {
  const totals = new Map<string, number>();
  for (const row of rows) {
    const currency = (row.currency || "EUR").trim().toUpperCase();
    totals.set(currency, (totals.get(currency) ?? 0) + (row.amount ?? 0));
  }
  return [...totals.entries()]
    .map(([currency, amount]) => ({ currency, amount }))
    .sort((a, b) => b.amount - a.amount);
}

function assertQuery(error: { message: string } | null, label: string) {
  if (error) throw new Error(`${label}: ${error.message}`);
}

export async function getDashboardMetrics(supabase: Client): Promise<DashboardMetrics> {
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const [
    activeLeadsResult,
    openOffersResult,
    totalVehiclesResult,
    availableVehiclesResult,
    allLeadsResult,
    newOpportunitiesResult,
    shortlistedResult,
    profileResult,
    activeSourcesResult,
    siteAgentsResult,
    recentRunsResult,
    recentSiteAgentRunsResult,
    lastSuccessfulRunResult,
    telegramFailuresResult,
    scannerHealthIssues,
  ] = await Promise.all([
    supabase.from("leads").select("*", { count: "exact", head: true }).not("status", "in", `(${CLOSED_LEAD_STATUSES.join(",")})`),
    supabase.from("offers").select("commission_amount_calculated,currency").in("status", OPEN_OFFER_STATUSES),
    supabase.from("vehicles").select("*", { count: "exact", head: true }),
    supabase.from("vehicles").select("*", { count: "exact", head: true }).eq("availability_status", "available"),
    supabase.from("leads").select("status"),
    supabase.from("listing_alerts").select("*", { count: "exact", head: true }).eq("decision_status", "new"),
    supabase.from("listing_alerts").select("*", { count: "exact", head: true }).eq("decision_status", "shortlisted"),
    supabase.from("users_profile").select("telegram_chat_id,telegram_verified_at").maybeSingle(),
    supabase.from("market_sources").select("key").eq("enabled", true).in("method", ["scrape", "web_search", "api"]),
    supabase.from("site_search_agents").select("source_key,status,last_success_at"),
    supabase.from("scanner_runs").select("new_count,alert_count").gte("started_at", since24h),
    supabase.from("site_search_agent_runs").select("inserted_count,alerts_created").gte("started_at", since24h),
    supabase.from("scanner_runs").select("finished_at,started_at").eq("status", "ok").order("started_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("listing_alerts").select("*", { count: "exact", head: true }).eq("status", "failed"),
    checkScannerHealth(supabase),
  ]);

  const checks: Array<[string, { error: { message: string } | null }]> = [
    ["Aktif müşteri sorgusu", activeLeadsResult], ["Teklif sorgusu", openOffersResult],
    ["Araç toplamı sorgusu", totalVehiclesResult], ["Uygun araç sorgusu", availableVehiclesResult],
    ["Müşteri hunisi sorgusu", allLeadsResult], ["Yeni fırsat sorgusu", newOpportunitiesResult],
    ["Kısa liste sorgusu", shortlistedResult], ["Telegram profil sorgusu", profileResult],
    ["Kaynak sorgusu", activeSourcesResult], ["Web Scout sorgusu", siteAgentsResult],
    ["Tarama hacmi sorgusu", recentRunsResult], ["Web Scout hacmi sorgusu", recentSiteAgentRunsResult],
    ["Son tarama sorgusu", lastSuccessfulRunResult], ["Telegram hata sorgusu", telegramFailuresResult],
  ];
  for (const [label, result] of checks) assertQuery(result.error, label);

  const leadsByStatus: Record<string, number> = {};
  for (const lead of allLeadsResult.data ?? []) {
    leadsByStatus[lead.status] = (leadsByStatus[lead.status] ?? 0) + 1;
  }

  const scannerMetrics = combineScannerMetrics({
    runtimeSources: activeSourcesResult.data ?? [],
    siteAgents: siteAgentsResult.data ?? [],
    scannerRuns: recentRunsResult.data ?? [],
    siteAgentRuns: recentSiteAgentRunsResult.data ?? [],
    lastScannerRun: lastSuccessfulRunResult.data,
    scannerHealthIssueCount: scannerHealthIssues.length,
  });
  return {
    activeLeadCount: activeLeadsResult.count ?? 0,
    openOfferCount: openOffersResult.data?.length ?? 0,
    expectedCommissionTotals: groupMoneyByCurrency((openOffersResult.data ?? []).map((offer) => ({
      amount: offer.commission_amount_calculated,
      currency: offer.currency,
    }))),
    totalVehicleCount: totalVehiclesResult.count ?? 0,
    availableVehicleCount: availableVehiclesResult.count ?? 0,
    leadsByStatus,
    newOpportunityCount: newOpportunitiesResult.count ?? 0,
    shortlistedOpportunityCount: shortlistedResult.count ?? 0,
    scannerHealthIssueCount: scannerHealthIssues.length,
    activeSourceCount: scannerMetrics.activeSourceCount,
    healthySourceCount: scannerMetrics.healthySourceCount,
    listingsDiscovered24h: scannerMetrics.listingsDiscovered24h,
    alertsCreated24h: scannerMetrics.alertsCreated24h,
    telegramFailureCount: telegramFailuresResult.count ?? 0,
    lastSuccessfulScanAt: scannerMetrics.lastSuccessfulScanAt,
    telegramReady: Boolean(profileResult.data?.telegram_chat_id && profileResult.data.telegram_verified_at),
    measuredAt: new Date().toISOString(),
  };
}

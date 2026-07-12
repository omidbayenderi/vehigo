import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, OfferStatus } from "@/lib/supabase/types";
import { checkScannerHealth } from "@/lib/services/scanner-health";

type Client = SupabaseClient<Database>;

const CLOSED_LEAD_STATUSES = ["closed_won", "closed_lost"];
const OPEN_OFFER_STATUSES: OfferStatus[] = ["draft", "sent"];

export type MoneyTotal = { currency: string; amount: number };

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
    recentRunsResult,
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
    supabase.from("market_sources").select("key", { count: "exact" }).eq("enabled", true).in("method", ["scrape", "web_search"]),
    supabase.from("scanner_runs").select("new_count,alert_count").gte("started_at", since24h),
    supabase.from("scanner_runs").select("finished_at,started_at").eq("status", "ok").order("started_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("listing_alerts").select("*", { count: "exact", head: true }).eq("status", "failed"),
    checkScannerHealth(supabase),
  ]);

  const checks: Array<[string, { error: { message: string } | null }]> = [
    ["Aktif müşteri sorgusu", activeLeadsResult], ["Teklif sorgusu", openOffersResult],
    ["Araç toplamı sorgusu", totalVehiclesResult], ["Uygun araç sorgusu", availableVehiclesResult],
    ["Müşteri hunisi sorgusu", allLeadsResult], ["Yeni fırsat sorgusu", newOpportunitiesResult],
    ["Kısa liste sorgusu", shortlistedResult], ["Telegram profil sorgusu", profileResult],
    ["Kaynak sorgusu", activeSourcesResult], ["Tarama hacmi sorgusu", recentRunsResult],
    ["Son tarama sorgusu", lastSuccessfulRunResult], ["Telegram hata sorgusu", telegramFailuresResult],
  ];
  for (const [label, result] of checks) assertQuery(result.error, label);

  const leadsByStatus: Record<string, number> = {};
  for (const lead of allLeadsResult.data ?? []) {
    leadsByStatus[lead.status] = (leadsByStatus[lead.status] ?? 0) + 1;
  }

  const recentRuns = recentRunsResult.data ?? [];
  const activeSourceCount = activeSourcesResult.count ?? 0;
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
    activeSourceCount,
    healthySourceCount: Math.max(0, activeSourceCount - scannerHealthIssues.length),
    listingsDiscovered24h: recentRuns.reduce((sum, run) => sum + (run.new_count ?? 0), 0),
    alertsCreated24h: recentRuns.reduce((sum, run) => sum + (run.alert_count ?? 0), 0),
    telegramFailureCount: telegramFailuresResult.count ?? 0,
    lastSuccessfulScanAt: lastSuccessfulRunResult.data?.finished_at ?? lastSuccessfulRunResult.data?.started_at ?? null,
    telegramReady: Boolean(profileResult.data?.telegram_chat_id && profileResult.data.telegram_verified_at),
    measuredAt: new Date().toISOString(),
  };
}

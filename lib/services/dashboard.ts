import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, OfferStatus } from "@/lib/supabase/types";
import { checkScannerHealth } from "@/lib/services/scanner-health";

type Client = SupabaseClient<Database>;

const CLOSED_LEAD_STATUSES = ["closed_won", "closed_lost"];
const OPEN_OFFER_STATUSES: OfferStatus[] = ["draft", "sent"];

export type DashboardMetrics = {
  activeLeadCount: number;
  openOfferCount: number;
  expectedCommissionTotal: number;
  totalVehicleCount: number;
  availableVehicleCount: number;
  leadsByStatus: Record<string, number>;
  newOpportunityCount: number;
  shortlistedOpportunityCount: number;
  scannerHealthIssueCount: number;
  telegramReady: boolean;
};

export async function getDashboardMetrics(supabase: Client): Promise<DashboardMetrics> {
  const [
    { count: activeLeadCount },
    { data: openOffers },
    { count: totalVehicleCount },
    { count: availableVehicleCount },
    { data: allLeads },
    { count: newOpportunityCount },
    { count: shortlistedOpportunityCount },
    { data: profile },
    scannerHealthIssues,
  ] = await Promise.all([
    supabase
      .from("leads")
      .select("*", { count: "exact", head: true })
      .not("status", "in", `(${CLOSED_LEAD_STATUSES.join(",")})`),
    supabase.from("offers").select("commission_amount_calculated").in("status", OPEN_OFFER_STATUSES),
    supabase.from("vehicles").select("*", { count: "exact", head: true }),
    supabase
      .from("vehicles")
      .select("*", { count: "exact", head: true })
      .eq("availability_status", "available"),
    supabase.from("leads").select("status"),
    supabase.from("listing_alerts").select("*", { count: "exact", head: true }).eq("decision_status", "new"),
    supabase.from("listing_alerts").select("*", { count: "exact", head: true }).eq("decision_status", "shortlisted"),
    supabase.from("users_profile").select("telegram_chat_id,telegram_verified_at").maybeSingle(),
    checkScannerHealth(supabase),
  ]);

  const expectedCommissionTotal = (openOffers ?? []).reduce(
    (sum, o) => sum + (o.commission_amount_calculated ?? 0),
    0,
  );

  const leadsByStatus: Record<string, number> = {};
  for (const lead of allLeads ?? []) {
    leadsByStatus[lead.status] = (leadsByStatus[lead.status] ?? 0) + 1;
  }

  return {
    activeLeadCount: activeLeadCount ?? 0,
    openOfferCount: (openOffers ?? []).length,
    expectedCommissionTotal,
    totalVehicleCount: totalVehicleCount ?? 0,
    availableVehicleCount: availableVehicleCount ?? 0,
    leadsByStatus,
    newOpportunityCount: newOpportunityCount ?? 0,
    shortlistedOpportunityCount: shortlistedOpportunityCount ?? 0,
    scannerHealthIssueCount: scannerHealthIssues.length,
    telegramReady: Boolean(profile?.telegram_chat_id && profile.telegram_verified_at),
  };
}

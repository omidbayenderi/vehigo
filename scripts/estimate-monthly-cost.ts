import { DEFAULT_MONTHLY_COST_INPUT, estimateMonthlyOperatingCost, type MonthlyCostInput } from "../lib/operations/cost-model";

const input: MonthlyCostInput = {
  daysPerMonth: envNumber("VEHIGO_COST_DAYS_PER_MONTH", DEFAULT_MONTHLY_COST_INPUT.daysPerMonth),
  braveAgents: envNumber("VEHIGO_COST_BRAVE_AGENTS", DEFAULT_MONTHLY_COST_INPUT.braveAgents),
  braveRunsPerDay: envNumber("VEHIGO_COST_BRAVE_RUNS_PER_DAY", DEFAULT_MONTHLY_COST_INPUT.braveRunsPerDay),
  braveRequestsPerAgentRun: envNumber("VEHIGO_COST_BRAVE_REQUESTS_PER_AGENT_RUN", DEFAULT_MONTHLY_COST_INPUT.braveRequestsPerAgentRun),
  braveUsdPerThousandRequests: envNumber("VEHIGO_COST_BRAVE_USD_PER_1000", DEFAULT_MONTHLY_COST_INPUT.braveUsdPerThousandRequests),
  braveMonthlyCreditUsd: envNumber("VEHIGO_COST_BRAVE_CREDIT_USD", DEFAULT_MONTHLY_COST_INPUT.braveMonthlyCreditUsd),
  apifyPlatformUsd: envNumber("VEHIGO_COST_APIFY_PLATFORM_USD", DEFAULT_MONTHLY_COST_INPUT.apifyPlatformUsd),
  apifyIncludedUsageUsd: envNumber("VEHIGO_COST_APIFY_INCLUDED_USAGE_USD", DEFAULT_MONTHLY_COST_INPUT.apifyIncludedUsageUsd),
  apifyActorUsageUsd: envNumber("VEHIGO_COST_APIFY_USAGE_USD", DEFAULT_MONTHLY_COST_INPUT.apifyActorUsageUsd),
  supabaseUsd: envNumber("VEHIGO_COST_SUPABASE_USD", DEFAULT_MONTHLY_COST_INPUT.supabaseUsd),
  hostingUsd: envNumber("VEHIGO_COST_HOSTING_USD", DEFAULT_MONTHLY_COST_INPUT.hostingUsd),
  openAiUsd: envNumber("VEHIGO_COST_OPENAI_USD", DEFAULT_MONTHLY_COST_INPUT.openAiUsd),
  monitoringUsd: envNumber("VEHIGO_COST_MONITORING_USD", DEFAULT_MONTHLY_COST_INPUT.monitoringUsd),
};

const estimate = estimateMonthlyOperatingCost(input);
console.log(`Vehigo aylık işletme tahmini (${estimate.braveRequests.toLocaleString("tr-TR")} Brave isteği)`);
for (const line of estimate.lines) console.log(`${line.label}: $${line.usd.toFixed(2)}${line.variable ? " (değişken)" : ""}`);
console.log(`Toplam: $${estimate.totalUsd.toFixed(2)} / ay`);

function envNumber(key: string, fallback: number) {
  const value = Number(process.env[key]);
  return Number.isFinite(value) && value >= 0 ? value : fallback;
}

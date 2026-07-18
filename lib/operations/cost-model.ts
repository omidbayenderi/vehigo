export type MonthlyCostInput = {
  daysPerMonth: number;
  braveAgents: number;
  braveRunsPerDay: number;
  braveRequestsPerAgentRun: number;
  braveUsdPerThousandRequests: number;
  braveMonthlyCreditUsd: number;
  apifyPlatformUsd: number;
  apifyIncludedUsageUsd: number;
  apifyActorUsageUsd: number;
  supabaseUsd: number;
  hostingUsd: number;
  openAiUsd: number;
  monitoringUsd: number;
};

export type MonthlyCostEstimate = {
  braveRequests: number;
  lines: Array<{ key: string; label: string; usd: number; variable: boolean }>;
  totalUsd: number;
};

export const DEFAULT_MONTHLY_COST_INPUT: MonthlyCostInput = {
  daysPerMonth: 30,
  braveAgents: 1,
  braveRunsPerDay: 9,
  braveRequestsPerAgentRun: 4,
  braveUsdPerThousandRequests: 5,
  braveMonthlyCreditUsd: 5,
  apifyPlatformUsd: 29,
  apifyIncludedUsageUsd: 29,
  apifyActorUsageUsd: 50,
  supabaseUsd: 25,
  hostingUsd: 20,
  openAiUsd: 10,
  monitoringUsd: 0,
};

export function estimateMonthlyOperatingCost(input: MonthlyCostInput): MonthlyCostEstimate {
  const braveRequests = input.daysPerMonth * input.braveAgents * input.braveRunsPerDay * input.braveRequestsPerAgentRun;
  const lines = [
    { key: "brave", label: "Brave Search API (aylık kredi sonrası)", usd: Math.max(0, braveRequests / 1000 * input.braveUsdPerThousandRequests - input.braveMonthlyCreditUsd), variable: true },
    { key: "apify_platform", label: "Apify platform", usd: input.apifyPlatformUsd, variable: false },
    { key: "apify_usage", label: "Apify kredi üstü Actor/proxy kullanımı", usd: Math.max(0, input.apifyActorUsageUsd - input.apifyIncludedUsageUsd), variable: true },
    { key: "supabase", label: "Supabase", usd: input.supabaseUsd, variable: false },
    { key: "hosting", label: "Uygulama hosting", usd: input.hostingUsd, variable: false },
    { key: "openai", label: "OpenAI analiz bütçesi", usd: input.openAiUsd, variable: true },
    { key: "monitoring", label: "İzleme", usd: input.monitoringUsd, variable: false },
  ].map((line) => ({ ...line, usd: round(line.usd) }));
  return { braveRequests, lines, totalUsd: round(lines.reduce((sum, line) => sum + line.usd, 0)) };
}

function round(value: number) { return Math.round((value + Number.EPSILON) * 100) / 100; }

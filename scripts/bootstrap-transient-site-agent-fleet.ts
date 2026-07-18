import { createAdminClient } from "@/lib/supabase/admin";
import { runDueSiteSearchAgents } from "@/lib/scanner/site-search-agents";

if (!process.argv.includes("--apply")) {
  throw new Error("Geçici ajan başlangıç turu için --apply bayrağı gerekli.");
}

const maxRuns = 1;

async function main() {
  const supabase = createAdminClient();
  const [{ data: agents, error: agentError }, { data: watchlists, error: watchlistError }] = await Promise.all([
    supabase.from("site_search_agents").select("id,status,processing_mode"),
    supabase.from("watchlists").select("*").eq("active", true),
  ]);
  if (agentError) throw agentError;
  if (watchlistError) throw watchlistError;
  if (agents.some((agent) => agent.status === "active" && agent.processing_mode !== "transient_search")) {
    throw new Error("Başlangıç turu yalnızca tamamen transient_search olan aktif filoda çalışır.");
  }

  const chefRunId = crypto.randomUUID();
  const totals = { claimed: 0, completed: 0, partial: 0, blocked: 0, failed: 0, fetched: 0, inserted: 0, alertsCreated: 0 };
  const sources: Array<{ sourceKey: string; status: string; errorCode?: string }> = [];

  for (let index = 0; index < maxRuns; index++) {
    const run = await runDueSiteSearchAgents(supabase, watchlists, {
      workerId: `transient-bootstrap-${chefRunId}-${index}`,
      chefRunId,
      limit: 1,
    });
    if (run.claimed === 0) break;
    for (const key of Object.keys(totals) as Array<keyof typeof totals>) totals[key] += run[key];
    sources.push(...run.sources);
    if (run.blocked > 0 || run.failed > 0) continue;
  }

  if (totals.inserted !== 0) throw new Error("Transient başlangıç turu kalıcı ilan yazdı; işlem durduruldu.");
  console.log(JSON.stringify({ chef_run_id: chefRunId, max_runs: maxRuns, ...totals, sources }, null, 2));
}

void main().catch((error: unknown) => {
  const message = error instanceof Error
    ? error.message
    : error && typeof error === "object" && "message" in error && typeof error.message === "string"
      ? error.message
      : "Geçici ajan başlangıç turu başarısız.";
  console.error(message);
  process.exitCode = 1;
});

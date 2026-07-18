import { createAdminClient } from "@/lib/supabase/admin";
import { runDueSiteSearchAgents, type SiteAgentFleetSummary } from "@/lib/scanner/site-search-agents";
import { applyE2eEnvironment } from "@/scripts/lib/e2e-environment";

if (!process.argv.includes("--apply")) throw new Error("Site-agent acceptance için --apply bayrağı gerekli.");
if (process.argv.includes("--e2e")) applyE2eEnvironment();
const live = process.argv.includes("--live");
const processingMode = process.argv.includes("--persistent") ? "persistent_search" : "transient_search";

async function main() {
  const supabase = createAdminClient();
  if (live) {
    if (!process.env.BRAVE_SEARCH_API_KEY) {
      throw new Error("Canlı acceptance için Brave anahtarı gerekli.");
    }
    if (processingMode === "persistent_search" && process.env.BRAVE_SEARCH_STORAGE_RIGHTS_CONFIRMED !== "true") {
      throw new Error("Persistent canlı acceptance için saklama hakkı doğrulaması gerekli.");
    }
    const activationRpc = processingMode === "persistent_search"
      ? "activate_site_search_agent_fleet"
      : "activate_transient_site_search_agent_fleet";
    const { error: activationError } = await supabase.rpc(activationRpc, {});
    if (activationError) throw activationError;
  }
  const [{ data: agents, error: agentError }, { data: marktplaats, error: sourceError }] = await Promise.all([
    supabase.from("site_search_agents").select("*").order("source_key"),
    supabase.from("market_sources").select("key,method,connector_version,connector_capabilities").eq("key", "marktplaats").single(),
  ]);
  if (agentError) throw agentError;
  if (sourceError) throw sourceError;
  const activeAgents = agents.filter((agent) => agent.status === "active");
  const unifiedAgent = agents.find((agent) => agent.source_key === "brave_web");
  if (!unifiedAgent) throw new Error("Birleşik brave_web Europe Web Scout bulunamadı.");
  if (activeAgents.some((agent) => agent.id !== unifiedAgent.id)) {
    throw new Error("Birleşik Europe Web Scout dışında aktif site agentı bulundu.");
  }
  if (live && (activeAgents.length !== 1 || activeAgents[0].id !== unifiedAgent.id)) {
    throw new Error(`Canlı doğrulamada tam olarak bir aktif Europe Web Scout bekleniyordu; bulunan: ${activeAgents.length}.`);
  }
  if (!live && !["pending_activation", "active"].includes(unifiedAgent.status)) {
    throw new Error(`Europe Web Scout beklemede veya aktif değil: ${unifiedAgent.status}.`);
  }
  if (unifiedAgent.provider_key !== "brave_web" || unifiedAgent.egress_policy !== "provider_managed" || unifiedAgent.acquisition_mode !== "web_index") {
    throw new Error("Europe Web Scout brave_web/web_index/provider_managed sözleşmesini taşımalıdır.");
  }
  if (live && unifiedAgent.processing_mode !== processingMode) {
    throw new Error(`Europe Web Scout ${processingMode} modunda değil.`);
  }
  if (agents.some((agent) => agent.source_key !== "brave_web" && agent.status !== "retired")) {
    throw new Error("Eski site agentlarının tamamı retired olmalıdır.");
  }
  if (marktplaats.method === "scrape" || marktplaats.connector_version) {
    throw new Error("Doğrudan Marktplaats HTML connectorı devre dışı değil.");
  }

  const candidate = unifiedAgent;
  const original = {
    status: candidate.status,
    next_run_at: candidate.next_run_at,
    locked_until: candidate.locked_until,
    locked_by: candidate.locked_by,
    lease_token: candidate.lease_token,
    reserved_request_count: candidate.reserved_request_count,
    daily_request_count: candidate.daily_request_count,
    daily_budget_date: candidate.daily_budget_date,
  };

  const { error: dueError } = await supabase.from("site_search_agents").update({
    status: "active",
    next_run_at: new Date(0).toISOString(),
    locked_until: null,
    locked_by: null,
    lease_token: null,
    reserved_request_count: 0,
  }).eq("id", candidate.id);
  if (dueError) throw dueError;

  try {
    const workerId = `site-agent-acceptance-${crypto.randomUUID()}`;
    const { data: claimed, error: claimError } = await supabase.rpc("claim_due_site_search_agents", {
      p_worker_id: workerId,
      p_limit: 1,
      p_lease_seconds: 60,
      p_source_key: candidate.source_key,
    });
    if (claimError) throw claimError;
    if (claimed.length !== 1 || claimed[0].id !== candidate.id || claimed[0].locked_by !== workerId) {
      throw new Error("Site agent atomik ve kaynak-bazlı claim edilemedi.");
    }
  } finally {
    const { error: restoreError } = await supabase.from("site_search_agents").update(original).eq("id", candidate.id);
    if (restoreError) throw restoreError;
  }

  let liveResult: SiteAgentFleetSummary | null = null;
  if (live) {
    const { error: dueError } = await supabase.from("site_search_agents").update({
      status: "active",
      next_run_at: new Date(0).toISOString(),
      locked_until: null,
      locked_by: null,
    }).eq("id", candidate.id);
    if (dueError) throw dueError;
    const { data: watchlists, error: watchlistError } = await supabase.from("watchlists").select("*").eq("active", true);
    if (watchlistError) throw watchlistError;
    liveResult = await runDueSiteSearchAgents(supabase, watchlists, { sourceKey: candidate.source_key, limit: 1 });
    if (liveResult.completed !== 1 || liveResult.failed !== 0 || liveResult.blocked !== 0) {
      throw new Error("Canlı site-agent acceptance başarılı tamamlanmadı.");
    }
  }

  console.log(JSON.stringify({
    agents: 1,
    retired_agents: agents.filter((agent) => agent.status === "retired").length,
    active_agents: activeAgents.length,
    transient_agents: activeAgents.filter((agent) => agent.processing_mode === "transient_search").length,
    provider: "brave_web",
    acquisition_mode: "web_index",
    egress_policy: "provider_managed",
    processing_mode: processingMode,
    direct_marktplaats_disabled: true,
    atomic_claim: true,
    live,
    live_result: liveResult,
  }, null, 2));
}

void main().catch((error: unknown) => {
  const message = error instanceof Error
    ? error.message
    : error && typeof error === "object" && "message" in error && typeof error.message === "string"
      ? error.message
      : "Site-agent acceptance başarısız.";
  console.error(message);
  process.exitCode = 1;
});

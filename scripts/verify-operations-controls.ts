import { randomUUID } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { consumeRateLimit, consumeUsageBudget, recordProviderObservation } from "@/lib/operations/controls";
import { applyE2eEnvironment } from "@/scripts/lib/e2e-environment";

if (!process.argv.includes("--apply")) throw new Error("Canli acceptance testi icin --apply bayragi gerekli.");
if (process.argv.includes("--e2e")) applyE2eEnvironment();

async function main() {
  const supabase = createAdminClient();
  const suffix = randomUUID().replaceAll("-", "").slice(0, 12);
  const rateKey = `acceptance.rate.${suffix}`;
  const budgetKey = `acceptance.budget.${suffix}`;
  const providerKey = `acceptance-provider-${suffix}`;
  const operationType = "connector.fetch";
  const correlationId = randomUUID();
  const [{ data: organizations, error: organizationError }, { data: owners, error: ownerError }] = await Promise.all([
    supabase.from("organizations").select("id").eq("slug", "vehigo-default"),
    supabase.from("users_profile").select("id").eq("role", "owner"),
  ]);
  if (organizationError) throw organizationError;
  if (ownerError) throw ownerError;
  if (organizations.length !== 1 || owners.length !== 1) throw new Error("Acceptance testi tek organizasyon ve tek owner gerektirir.");
  const organizationId = organizations[0].id;
  const ownerId = owners[0].id;

  const [ratePolicy, budgetPolicy, sloPolicy, drill] = await Promise.all([
    supabase.from("rate_limit_policies").insert({ organization_id: organizationId, limit_key: rateKey, window_seconds: 60, max_requests: 2, created_by: ownerId }).select("id").single(),
    supabase.from("usage_budget_policies").insert({ organization_id: organizationId, budget_key: budgetKey, period: "daily", unit: "request", soft_limit: 2, hard_limit: 3, enforcement: "block", created_by: ownerId }).select("id").single(),
    supabase.from("provider_slo_policies").insert({ organization_id: organizationId, provider_key: providerKey, operation_type: operationType, target_availability_percent: 100, max_error_rate_percent: 0, max_p95_latency_ms: 10, window_minutes: 60, minimum_samples: 2, created_by: ownerId }).select("id").single(),
    supabase.from("recovery_drills").insert({ organization_id: organizationId, drill_type: "queue_recovery", scope: `Acceptance ${suffix}: queue control-plane recovery`, created_by: ownerId }).select("id,status").single(),
  ]);
  for (const result of [ratePolicy, budgetPolicy, sloPolicy, drill]) if (result.error) throw result.error;
  if (!ratePolicy.data || !budgetPolicy.data || !sloPolicy.data || !drill.data) {
    throw new Error("Acceptance kontrol kayitlari olusturulamadi.");
  }

  const ratePolicyId = ratePolicy.data.id;
  const budgetPolicyId = budgetPolicy.data.id;
  const sloPolicyId = sloPolicy.data.id;
  const recoveryDrill = drill.data;

  const rateDecisions = [
    await consumeRateLimit(supabase, { organizationId, limitKey: rateKey, subjectKey: "acceptance-worker" }),
    await consumeRateLimit(supabase, { organizationId, limitKey: rateKey, subjectKey: "acceptance-worker" }),
    await consumeRateLimit(supabase, { organizationId, limitKey: rateKey, subjectKey: "acceptance-worker" }),
  ];
  const budgetDecisions = [
    await consumeUsageBudget(supabase, { organizationId, budgetKey, amount: 2, unit: "request", correlationId }),
    await consumeUsageBudget(supabase, { organizationId, budgetKey, amount: 2, unit: "request", correlationId }),
  ];
  const sloDecisions = [
    await recordProviderObservation(supabase, { organizationId, providerKey, operationType, outcome: "success", durationMs: 5, correlationId }),
    await recordProviderObservation(supabase, { organizationId, providerKey, operationType, outcome: "failure", durationMs: 20, correlationId, errorCode: "acceptance_failure" }),
  ];

  const [{ data: alerts, error: alertError }, { count: usageRows, error: usageError }] = await Promise.all([
    supabase.from("operation_alerts").select("alert_type,severity,status,title,details").eq("organization_id", organizationId).or(`dedupe_key.like.rate_limit:${rateKey}:%,dedupe_key.like.budget:${budgetKey}:%,dedupe_key.eq.slo:${sloPolicyId}`).order("created_at"),
    supabase.from("usage_ledger").select("id", { count: "exact", head: true }).eq("organization_id", organizationId).eq("budget_key", budgetKey),
  ]);
  if (alertError) throw alertError;
  if (usageError) throw usageError;

  const acceptance = {
    rate_limit: { allowed_sequence: rateDecisions.map((decision) => decision.allowed), final_remaining: rateDecisions[2].remaining },
    budget: { allowed_sequence: budgetDecisions.map((decision) => decision.allowed), ledger_rows: usageRows, final_projected: budgetDecisions[1].projected },
    slo: { breach_sequence: sloDecisions.map((decision) => decision.breached), final_samples: sloDecisions[1].samples },
    recovery_drill: recoveryDrill,
    alerts,
  };

  await Promise.all([
    supabase.from("rate_limit_counters").delete().eq("organization_id", organizationId).eq("limit_key", rateKey),
    supabase.from("usage_ledger").delete().eq("organization_id", organizationId).eq("budget_key", budgetKey),
    supabase.from("provider_observations").delete().eq("organization_id", organizationId).eq("provider_key", providerKey),
    supabase.from("operation_alerts").delete().eq("organization_id", organizationId).or(`dedupe_key.like.rate_limit:${rateKey}:%,dedupe_key.like.budget:${budgetKey}:%,dedupe_key.eq.slo:${sloPolicyId}`),
    supabase.from("recovery_drills").delete().eq("id", recoveryDrill.id),
  ]);
  await Promise.all([
    supabase.from("rate_limit_policies").delete().eq("id", ratePolicyId),
    supabase.from("usage_budget_policies").delete().eq("id", budgetPolicyId),
    supabase.from("provider_slo_policies").delete().eq("id", sloPolicyId),
  ]);

  console.log(JSON.stringify(acceptance));
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Operations controls acceptance testi basarisiz.");
  process.exitCode = 1;
});

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json, ProviderObservationOutcome } from "@/lib/supabase/types";
import { OperationRuntimeError } from "@/lib/operations/runtime";

type Client = SupabaseClient<Database>;

export type RateLimitDecision = { configured: boolean; allowed: boolean; remaining: number | null; retryAfterSeconds: number };
export type BudgetDecision = { configured: boolean; allowed: boolean; recorded: boolean; usedBefore: number; projected: number; softLimit: number | null; hardLimit: number | null; unit: string };
export type SloDecision = { configured: boolean; breached: boolean; samples?: number; availabilityPercent?: number; errorRatePercent?: number; p95LatencyMs?: number };

export async function consumeRateLimit(supabase: Client, input: { organizationId: string; limitKey: string; subjectKey: string; units?: number }): Promise<RateLimitDecision> {
  const { data, error } = await supabase.rpc("consume_rate_limit", { p_organization_id: input.organizationId, p_limit_key: input.limitKey, p_subject_key: input.subjectKey, p_units: input.units ?? 1 });
  if (error) throw new OperationRuntimeError("rate_limit_failed", "Rate-limit kararı alınamadı.");
  const value = object(data);
  return { configured: value.configured === true, allowed: value.allowed !== false, remaining: numberOrNull(value.remaining), retryAfterSeconds: numberOrZero(value.retry_after_seconds) };
}

export async function consumeUsageBudget(supabase: Client, input: { organizationId: string; budgetKey: string; amount: number; unit: string; correlationId: string; jobId?: string; costAmount?: number; costCurrency?: string; metadata?: unknown }): Promise<BudgetDecision> {
  const { data, error } = await supabase.rpc("consume_usage_budget", { p_organization_id: input.organizationId, p_budget_key: input.budgetKey, p_amount: input.amount, p_unit: input.unit, p_correlation_id: input.correlationId, p_job_id: input.jobId, p_cost_amount: input.costAmount, p_cost_currency: input.costCurrency, p_metadata: json(input.metadata ?? {}) });
  if (error) throw new OperationRuntimeError("budget_decision_failed", "Kullanım bütçesi kararı alınamadı.");
  const value = object(data);
  return { configured: value.configured === true, allowed: value.allowed !== false, recorded: value.recorded === true, usedBefore: numberOrZero(value.used_before), projected: numberOrZero(value.projected), softLimit: numberOrNull(value.soft_limit), hardLimit: numberOrNull(value.hard_limit), unit: typeof value.unit === "string" ? value.unit : input.unit };
}

export async function recordProviderObservation(supabase: Client, input: { organizationId: string; providerKey: string; operationType: string; outcome: ProviderObservationOutcome; durationMs: number; correlationId: string; jobId?: string; errorCode?: string; costAmount?: number; costCurrency?: string; metadata?: unknown }): Promise<SloDecision> {
  const { data, error } = await supabase.rpc("record_provider_observation", { p_organization_id: input.organizationId, p_provider_key: input.providerKey, p_operation_type: input.operationType, p_outcome: input.outcome, p_duration_ms: Math.max(0, Math.trunc(input.durationMs)), p_correlation_id: input.correlationId, p_job_id: input.jobId, p_error_code: input.errorCode, p_cost_amount: input.costAmount, p_cost_currency: input.costCurrency, p_metadata: json(input.metadata ?? {}) });
  if (error) throw new OperationRuntimeError("provider_observation_failed", "Provider gözlemi kaydedilemedi.");
  const value = object(data);
  return { configured: value.configured === true, breached: value.breached === true, samples: numberOrUndefined(value.samples), availabilityPercent: numberOrUndefined(value.availability_percent), errorRatePercent: numberOrUndefined(value.error_rate_percent), p95LatencyMs: numberOrUndefined(value.p95_latency_ms) };
}

function object(value: Json): Record<string, Json> { return value && typeof value === "object" && !Array.isArray(value) ? value : {}; }
function numberOrZero(value: Json | undefined) { return typeof value === "number" ? value : 0; }
function numberOrNull(value: Json | undefined) { return typeof value === "number" ? value : null; }
function numberOrUndefined(value: Json | undefined) { return typeof value === "number" ? value : undefined; }
function json(value: unknown): Json { return JSON.parse(JSON.stringify(value ?? null)) as Json; }

"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireOrganizationOwner } from "@/lib/operations/authorization";
import { createClient } from "@/lib/supabase/server";
import { logAudit } from "@/lib/services/audit";

export type OperationFormState = { error?: string; ok?: string };

const key = z.string().trim().regex(/^[a-z][a-z0-9._-]{0,119}$/, "Anahtar küçük harfle başlamalı; yalnızca harf, sayı, nokta, alt çizgi ve tire içermeli.");
const sloSchema = z.object({
  provider_key: z.string().trim().regex(/^[A-Za-z0-9._:-]{1,120}$/),
  operation_type: key,
  target_availability_percent: z.coerce.number().min(0).max(100),
  max_error_rate_percent: z.coerce.number().min(0).max(100),
  max_p95_latency_ms: z.coerce.number().int().min(1).max(3_600_000),
  window_minutes: z.coerce.number().int().min(1).max(43_200),
  minimum_samples: z.coerce.number().int().min(1).max(1_000_000),
});
const budgetSchema = z.object({
  budget_key: key,
  period: z.enum(["daily", "monthly"]),
  unit: z.string().trim().regex(/^[A-Za-z][A-Za-z0-9._-]{0,39}$/),
  soft_limit: z.coerce.number().min(0),
  hard_limit: z.coerce.number().positive(),
  enforcement: z.enum(["warn", "block"]),
}).refine((value) => value.hard_limit >= value.soft_limit, { message: "Hard limit, soft limitten küçük olamaz." });
const rateSchema = z.object({
  limit_key: key,
  window_seconds: z.coerce.number().int().min(1).max(86_400),
  max_requests: z.coerce.number().int().min(1).max(100_000_000),
});
const drillSchema = z.object({
  drill_type: z.enum(["backup_restore", "provider_outage", "queue_recovery", "credential_rotation", "data_retention"]),
  scope: z.string().trim().min(3).max(1000),
  planned_for: z.string().optional(),
});
const drillEvidenceSchema = z.object({
  status: z.enum(["passed", "failed"]),
  notes: z.string().trim().min(3, "Kanıt notu en az 3 karakter olmalı.").max(2000),
  evidence_url: z.string().trim().url("Kanıt bağlantısı geçerli bir URL olmalı.").optional(),
  rto_minutes: z.coerce.number().min(0).max(525_600).optional(),
  rpo_minutes: z.coerce.number().min(0).max(525_600).optional(),
});

async function ownerContext() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const organizationId = await requireOrganizationOwner(supabase, user.id);
  return { supabase, user, organizationId };
}

function values(formData: FormData) {
  return Object.fromEntries(Array.from(formData.entries()).filter(([name]) => !name.startsWith("$ACTION_")));
}

function failure(error: unknown): OperationFormState {
  if (error instanceof z.ZodError) return { error: error.issues[0]?.message ?? "Alanları kontrol edin." };
  return { error: error instanceof Error ? error.message : "İşlem tamamlanamadı." };
}

export async function createSloPolicyAction(_state: OperationFormState, formData: FormData): Promise<OperationFormState> {
  try {
    const { supabase, user, organizationId } = await ownerContext();
    const parsed = sloSchema.parse(values(formData));
    const { data, error } = await supabase.from("provider_slo_policies").insert({ ...parsed, organization_id: organizationId, created_by: user.id }).select("id").single();
    if (error) throw new Error(error.message);
    await logAudit(supabase, user.id, "create", "provider_slo_policy", data.id, parsed, organizationId);
    revalidatePath("/operations");
    return { ok: "SLO politikası etkinleştirildi." };
  } catch (error) { return failure(error); }
}

export async function createBudgetPolicyAction(_state: OperationFormState, formData: FormData): Promise<OperationFormState> {
  try {
    const { supabase, user, organizationId } = await ownerContext();
    const parsed = budgetSchema.parse(values(formData));
    const { data, error } = await supabase.from("usage_budget_policies").insert({ ...parsed, organization_id: organizationId, created_by: user.id }).select("id").single();
    if (error) throw new Error(error.message);
    await logAudit(supabase, user.id, "create", "usage_budget_policy", data.id, parsed, organizationId);
    revalidatePath("/operations");
    return { ok: "Kullanım bütçesi etkinleştirildi." };
  } catch (error) { return failure(error); }
}

export async function createRatePolicyAction(_state: OperationFormState, formData: FormData): Promise<OperationFormState> {
  try {
    const { supabase, user, organizationId } = await ownerContext();
    const parsed = rateSchema.parse(values(formData));
    const { data, error } = await supabase.from("rate_limit_policies").insert({ ...parsed, organization_id: organizationId, created_by: user.id }).select("id").single();
    if (error) throw new Error(error.message);
    await logAudit(supabase, user.id, "create", "rate_limit_policy", data.id, parsed, organizationId);
    revalidatePath("/operations");
    return { ok: "Rate-limit politikası etkinleştirildi." };
  } catch (error) { return failure(error); }
}

export async function createRecoveryDrillAction(_state: OperationFormState, formData: FormData): Promise<OperationFormState> {
  try {
    const { supabase, user, organizationId } = await ownerContext();
    const parsed = drillSchema.parse(values(formData));
    const { data, error } = await supabase.from("recovery_drills").insert({ organization_id: organizationId, drill_type: parsed.drill_type, scope: parsed.scope, planned_for: parsed.planned_for ? new Date(parsed.planned_for).toISOString() : null, created_by: user.id }).select("id").single();
    if (error) throw new Error(error.message);
    await logAudit(supabase, user.id, "create", "recovery_drill", data.id, { drill_type: parsed.drill_type }, organizationId);
    revalidatePath("/operations");
    return { ok: "Kurtarma tatbikatı planlandı." };
  } catch (error) { return failure(error); }
}

export async function startRecoveryDrillAction(drillId: string, _state: OperationFormState, _formData: FormData): Promise<OperationFormState> {
  void _state;
  void _formData;
  try {
    const { supabase, organizationId } = await ownerContext();
    const { data: drill } = await supabase.from("recovery_drills").select("id,status").eq("id", drillId).eq("organization_id", organizationId).single();
    if (!drill || drill.status !== "planned") throw new Error("Yalnız planlanmış bir tatbikat başlatılabilir.");
    const { error } = await supabase.rpc("start_recovery_drill", { p_drill_id: drill.id });
    if (error) throw new Error(error.message);
    revalidatePath("/operations");
    return { ok: "Tatbikat başlatıldı; zaman ölçümü başladı." };
  } catch (error) { return failure(error); }
}

export async function completeRecoveryDrillAction(drillId: string, _state: OperationFormState, formData: FormData): Promise<OperationFormState> {
  try {
    const { supabase, organizationId } = await ownerContext();
    const parsed = drillEvidenceSchema.parse(values(formData));
    const { data: drill } = await supabase.from("recovery_drills").select("id,status").eq("id", drillId).eq("organization_id", organizationId).single();
    if (!drill || drill.status !== "running") throw new Error("Yalnız çalışan bir tatbikat kanıtla kapatılabilir.");
    const evidence = { notes: parsed.notes, evidence_url: parsed.evidence_url ?? null, rto_minutes: parsed.rto_minutes ?? null, rpo_minutes: parsed.rpo_minutes ?? null, recorded_at: new Date().toISOString() };
    const { error } = await supabase.rpc("complete_recovery_drill", { p_drill_id: drill.id, p_status: parsed.status, p_evidence: evidence });
    if (error) throw new Error(error.message);
    revalidatePath("/operations");
    return { ok: parsed.status === "passed" ? "Tatbikat kanıtla başarıyla kapatıldı." : "Tatbikat başarısız kapatıldı; kritik uyarı açıldı." };
  } catch (error) { return failure(error); }
}

export async function acknowledgeAlertAction(alertId: string) {
  const { supabase, user, organizationId } = await ownerContext();
  const { data: alert } = await supabase.from("operation_alerts").select("id").eq("id", alertId).eq("organization_id", organizationId).single();
  if (!alert) throw new Error("Uyarı bulunamadı.");
  const { error } = await supabase.rpc("acknowledge_operation_alert", { p_alert_id: alert.id });
  if (error) throw new Error(error.message);
  await logAudit(supabase, user.id, "acknowledge", "operation_alert", alert.id, undefined, organizationId);
  revalidatePath("/operations");
}

export async function replayDeadLetterAction(jobId: string) {
  const { supabase, user, organizationId } = await ownerContext();
  const { data: job } = await supabase.from("operation_jobs").select("id,status").eq("id", jobId).eq("organization_id", organizationId).single();
  if (!job || job.status !== "dead_letter") throw new Error("Replay için dead-letter işi bulunamadı.");
  const { error } = await supabase.rpc("replay_dead_letter_operation", { p_job_id: job.id });
  if (error) throw new Error(error.message);
  await logAudit(supabase, user.id, "replay", "operation_job", job.id, undefined, organizationId);
  revalidatePath("/operations");
}

import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/lib/supabase/types";
import { applyE2eEnvironment } from "@/scripts/lib/e2e-environment";

if (!process.argv.includes("--apply")) throw new Error("Canli acceptance testi icin --apply bayragi gerekli.");
if (process.argv.includes("--e2e")) applyE2eEnvironment();

async function main() {
  const admin = createAdminClient();
  const suffix = randomUUID().replaceAll("-", "").slice(0, 12);
  const email = `operations-acceptance-${suffix}@example.invalid`;
  const password = `Acceptance-${randomUUID()}!`;
  const createdJobIds: string[] = [];
  const createdDrillIds: string[] = [];
  let temporaryUserId: string | undefined;
  let organizationId: string | undefined;

  try {
    const { data: organization, error: organizationError } = await admin.from("organizations").select("id").eq("slug", "vehigo-default").single();
    if (organizationError) throw organizationError;
    organizationId = organization.id;

    const { data: authUser, error: authError } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    if (authError) throw authError;
    temporaryUserId = authUser.user.id;

    const { error: profileError } = await admin.from("users_profile").upsert({ id: temporaryUserId, full_name: "Operations Acceptance", role: "broker" });
    if (profileError) throw profileError;
    const { error: membershipError } = await admin.from("organization_members").insert({ organization_id: organizationId, user_id: temporaryUserId, role: "owner", status: "active", invited_by: temporaryUserId });
    if (membershipError) throw membershipError;

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !anonKey) throw new Error("Supabase URL ve anon key gerekli.");
    const ownerClient = createClient<Database>(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { error: signInError } = await ownerClient.auth.signInWithPassword({ email, password });
    if (signInError) throw signInError;

    const leaseToken = randomUUID();
    const correlationId = randomUUID();
    const expiredLease = await admin.from("operation_jobs").insert({ organization_id: organizationId, queue: "acceptance", job_type: "acceptance.lease_recovery", idempotency_key: `lease-${suffix}`, payload_hash: "a".repeat(64), payload: { acceptance: true }, status: "running", attempt_count: 1, max_attempts: 2, lease_owner: "acceptance-worker", lease_token: leaseToken, lease_expires_at: new Date(Date.now() - 60_000).toISOString(), correlation_id: correlationId }).select("id").single();
    if (expiredLease.error) throw expiredLease.error;
    createdJobIds.push(expiredLease.data.id);
    const { error: attemptError } = await admin.from("operation_attempts").insert({ organization_id: organizationId, job_id: expiredLease.data.id, attempt_number: 1, worker_id: "acceptance-worker", lease_token: leaseToken, status: "running" });
    if (attemptError) throw attemptError;

    const expiredPayload = await admin.from("operation_jobs").insert({ organization_id: organizationId, queue: "acceptance", job_type: "acceptance.retention", idempotency_key: `retention-${suffix}`, payload_hash: "b".repeat(64), payload: { sensitive: "must-be-scrubbed" }, result: { retained: false }, status: "succeeded", attempt_count: 1, max_attempts: 1, completed_at: new Date(Date.now() - 120_000).toISOString(), retention_until: new Date(Date.now() - 60_000).toISOString() }).select("id").single();
    if (expiredPayload.error) throw expiredPayload.error;
    createdJobIds.push(expiredPayload.data.id);
    const { error: observationError } = await admin.from("provider_observations").insert({ organization_id: organizationId, provider_key: `acceptance-${suffix}`, operation_type: "connector.fetch", outcome: "success", duration_ms: 1, correlation_id: randomUUID(), retention_until: new Date(Date.now() - 60_000).toISOString() });
    if (observationError) throw observationError;

    const { data: maintenance, error: maintenanceError } = await admin.rpc("run_operational_maintenance");
    if (maintenanceError) throw maintenanceError;
    const [{ data: recoveredJob, error: recoveredError }, { data: scrubbedJob, error: scrubbedError }, { count: expiredObservations, error: observationCountError }] = await Promise.all([
      admin.from("operation_jobs").select("status,lease_token,lease_expires_at,error_code").eq("id", expiredLease.data.id).single(),
      admin.from("operation_jobs").select("payload,result").eq("id", expiredPayload.data.id).single(),
      admin.from("provider_observations").select("id", { count: "exact", head: true }).eq("provider_key", `acceptance-${suffix}`),
    ]);
    if (recoveredError) throw recoveredError;
    if (scrubbedError) throw scrubbedError;
    if (observationCountError) throw observationCountError;

    const passedDrill = await admin.from("recovery_drills").insert({ organization_id: organizationId, drill_type: "queue_recovery", scope: `Acceptance ${suffix}: authenticated owner lifecycle`, created_by: temporaryUserId }).select("id,status").single();
    if (passedDrill.error) throw passedDrill.error;
    createdDrillIds.push(passedDrill.data.id);
    const { data: started, error: startError } = await ownerClient.rpc("start_recovery_drill", { p_drill_id: passedDrill.data.id });
    if (startError) throw startError;
    const { error: emptyEvidenceError } = await ownerClient.rpc("complete_recovery_drill", { p_drill_id: passedDrill.data.id, p_status: "passed", p_evidence: {} });
    if (!emptyEvidenceError) throw new Error("Bos kanitla recovery drill tamamlama reddedilmedi.");
    const { data: passed, error: passError } = await ownerClient.rpc("complete_recovery_drill", { p_drill_id: passedDrill.data.id, p_status: "passed", p_evidence: { acceptance: true, rto_seconds: 8, verified_at: new Date().toISOString() } });
    if (passError) throw passError;

    const failedDrill = await admin.from("recovery_drills").insert({ organization_id: organizationId, drill_type: "provider_outage", scope: `Acceptance ${suffix}: failed drill alert`, created_by: temporaryUserId }).select("id").single();
    if (failedDrill.error) throw failedDrill.error;
    createdDrillIds.push(failedDrill.data.id);
    const { error: failedStartError } = await ownerClient.rpc("start_recovery_drill", { p_drill_id: failedDrill.data.id });
    if (failedStartError) throw failedStartError;
    const { data: failed, error: failError } = await ownerClient.rpc("complete_recovery_drill", { p_drill_id: failedDrill.data.id, p_status: "failed", p_evidence: { acceptance: true, reason: "intentional_failure" } });
    if (failError) throw failError;
    const { data: failureAlert, error: alertError } = await admin.from("operation_alerts").select("alert_type,severity,status").eq("organization_id", organizationId).eq("dedupe_key", `recovery_drill:${failedDrill.data.id}`).single();
    if (alertError) throw alertError;

    const authorizationDrill = await admin.from("recovery_drills").insert({ organization_id: organizationId, drill_type: "credential_rotation", scope: `Acceptance ${suffix}: non-owner rejection`, created_by: temporaryUserId }).select("id").single();
    if (authorizationDrill.error) throw authorizationDrill.error;
    createdDrillIds.push(authorizationDrill.data.id);
    const { error: downgradeError } = await admin.from("organization_members").update({ role: "broker" }).eq("organization_id", organizationId).eq("user_id", temporaryUserId);
    if (downgradeError) throw downgradeError;
    const { error: nonOwnerError } = await ownerClient.rpc("start_recovery_drill", { p_drill_id: authorizationDrill.data.id });
    if (!nonOwnerError) throw new Error("Owner olmayan kullanicinin recovery drill baslatmasi reddedilmedi.");
    const { error: restoreOwnerError } = await admin.from("organization_members").update({ role: "owner" }).eq("organization_id", organizationId).eq("user_id", temporaryUserId);
    if (restoreOwnerError) throw restoreOwnerError;

    console.log(JSON.stringify({
      maintenance,
      lease_recovery: recoveredJob,
      retention: { job: scrubbedJob, expired_observations: expiredObservations },
      recovery_drill: { sequence: [passedDrill.data.status, started.status, passed.status], evidence_recorded: Object.keys(passed.evidence ?? {}).length > 0, empty_evidence_rejected: Boolean(emptyEvidenceError) },
      failed_drill: { status: failed.status, alert: failureAlert },
      authorization: { non_owner_rejected: Boolean(nonOwnerError) },
    }));
  } finally {
    if (organizationId && createdDrillIds.length) {
      await admin.from("operation_alerts").delete().eq("organization_id", organizationId).in("dedupe_key", createdDrillIds.map((id) => `recovery_drill:${id}`));
      await admin.from("recovery_drills").delete().in("id", createdDrillIds);
    }
    if (createdJobIds.length) await admin.from("operation_jobs").delete().in("id", createdJobIds);
    if (temporaryUserId) await admin.auth.admin.deleteUser(temporaryUserId);
  }
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Operational maintenance acceptance testi basarisiz.");
  process.exitCode = 1;
});

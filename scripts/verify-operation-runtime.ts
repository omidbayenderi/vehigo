import { randomUUID } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { claimOperationJobs, completeOperationJob, enqueueOperation, failOperationJob, heartbeatOperationJob } from "@/lib/operations/runtime";
import { applyE2eEnvironment } from "@/scripts/lib/e2e-environment";

if (!process.argv.includes("--apply")) throw new Error("Canli acceptance testi icin --apply bayragi gerekli.");
if (process.argv.includes("--e2e")) applyE2eEnvironment();

async function main() {
  const supabase = createAdminClient();
  const [{ data: organizations, error: organizationError }, { data: owners, error: ownerError }] = await Promise.all([
    supabase.from("organizations").select("id").eq("slug", "vehigo-default"),
    supabase.from("users_profile").select("id").eq("role", "owner"),
  ]);
  if (organizationError) throw organizationError;
  if (ownerError) throw ownerError;
  if (organizations.length !== 1 || owners.length !== 1) throw new Error("Acceptance testi tek varsayilan organizasyon ve tek owner gerektirir.");

  const runId = randomUUID();
  const queue = `system.acceptance.${runId.slice(0, 8)}`;
  const organizationId = organizations[0].id;
  const ownerId = owners[0].id;
  const payload = { acceptance: true, run_id: runId, path: "success" };
  const created = await enqueueOperation(supabase, { organizationId, queue, jobType: "runtime.success", payload, idempotencyKey: `acceptance:${runId}:success`, maxAttempts: 2, retentionDays: 1, createdBy: ownerId });
  const duplicate = await enqueueOperation(supabase, { organizationId, queue, jobType: "runtime.success", payload, idempotencyKey: `acceptance:${runId}:success`, maxAttempts: 2, retentionDays: 1, createdBy: ownerId });
  const claimed = await claimOperationJobs(supabase, `acceptance-worker-${runId.slice(0, 8)}`, [queue], { limit: 1, leaseSeconds: 60 });
  if (claimed.length !== 1 || claimed[0].id !== created.job.id) throw new Error("Success job atomik olarak claim edilemedi.");
  await heartbeatOperationJob(supabase, claimed[0], 60);
  const completed = await completeOperationJob(supabase, claimed[0], { ok: true }, { duration_source: "acceptance" });

  const failedPayload = { acceptance: true, run_id: runId, path: "dead_letter" };
  const failedCreated = await enqueueOperation(supabase, { organizationId, queue, jobType: "runtime.failure", payload: failedPayload, idempotencyKey: `acceptance:${runId}:failure`, maxAttempts: 1, retentionDays: 1, createdBy: ownerId });
  const failedClaim = await claimOperationJobs(supabase, `acceptance-worker-${runId.slice(0, 8)}`, [queue], { limit: 1, leaseSeconds: 60 });
  if (failedClaim.length !== 1 || failedClaim[0].id !== failedCreated.job.id) throw new Error("Failure job atomik olarak claim edilemedi.");
  const deadLetter = await failOperationJob(supabase, failedClaim[0], new Error("intentional acceptance failure"), { retryable: true, code: "acceptance_failure" });

  const [{ count: attemptCount, error: attemptError }, { count: eventCount, error: eventError }] = await Promise.all([
    supabase.from("operation_attempts").select("id", { count: "exact", head: true }).in("job_id", [created.job.id, failedCreated.job.id]),
    supabase.from("operation_events").select("id", { count: "exact", head: true }).in("job_id", [created.job.id, failedCreated.job.id]),
  ]);
  if (attemptError) throw attemptError;
  if (eventError) throw eventError;

  console.log(JSON.stringify({
    run_id: runId,
    queue,
    success: { job_id: completed.id, status: completed.status, duplicate_detected: duplicate.duplicate, same_job: duplicate.job.id === created.job.id, attempts: completed.attempt_count },
    failure: { job_id: deadLetter.id, status: deadLetter.status, error_code: deadLetter.error_code, attempts: deadLetter.attempt_count },
    attempt_rows: attemptCount,
    event_rows: eventCount,
  }));
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Operation runtime acceptance testi basarisiz.");
  process.exitCode = 1;
});

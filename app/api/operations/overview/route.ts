import { requireOrganizationOwner } from "@/lib/operations/authorization";
import { OperationRuntimeError } from "@/lib/operations/runtime";
import { createClient } from "@/lib/supabase/server";
import type { OperationJobStatus } from "@/lib/supabase/types";

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Oturum gerekli." }, { status: 401 });
  try {
    const organizationId = await requireOrganizationOwner(supabase, user.id, request.headers.get("x-organization-id"));
    const since = new Date(Date.now() - 24 * 60 * 60_000).toISOString();
    const [queued, running, retrying, deadLetter, succeeded, failedAttempts, recentEvents] = await Promise.all([
      countJobs(supabase, organizationId, "queued"),
      countJobs(supabase, organizationId, ["leased", "running"]),
      countJobs(supabase, organizationId, "retry_wait"),
      countJobs(supabase, organizationId, "dead_letter"),
      countJobs(supabase, organizationId, "succeeded", since),
      supabase.from("operation_attempts").select("id", { count: "exact", head: true }).eq("organization_id", organizationId).in("status", ["failed", "lease_expired"]).gte("started_at", since),
      supabase.from("operation_events").select("id,job_id,correlation_id,level,event_type,message,attributes,occurred_at").eq("organization_id", organizationId).order("occurred_at", { ascending: false }).limit(50),
    ]);
    for (const result of [queued, running, retrying, deadLetter, succeeded, failedAttempts, recentEvents]) if (result.error) throw result.error;
    return Response.json({ organization_id: organizationId, window: { hours: 24, since }, counts: { queued: queued.count ?? 0, running: running.count ?? 0, retry_wait: retrying.count ?? 0, dead_letter: deadLetter.count ?? 0, succeeded_24h: succeeded.count ?? 0, failed_attempts_24h: failedAttempts.count ?? 0 }, events: recentEvents.data ?? [] });
  } catch (error) {
    if (error instanceof OperationRuntimeError) return Response.json({ error: error.message, code: error.code }, { status: 403 });
    return Response.json({ error: "Operasyon özeti okunamadı." }, { status: 500 });
  }
}

function countJobs(supabase: Awaited<ReturnType<typeof createClient>>, organizationId: string, status: OperationJobStatus | OperationJobStatus[], since?: string) {
  let query = supabase.from("operation_jobs").select("id", { count: "exact", head: true }).eq("organization_id", organizationId);
  query = typeof status === "string" ? query.eq("status", status) : query.in("status", status);
  return since ? query.gte("completed_at", since) : query;
}

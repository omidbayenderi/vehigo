import { NextRequest } from "next/server";
import { z } from "zod";
import { requireOrganizationOwner } from "@/lib/operations/authorization";
import { OperationRuntimeError } from "@/lib/operations/runtime";
import { createClient } from "@/lib/supabase/server";

const querySchema = z.object({
  status: z.enum(["queued", "leased", "running", "retry_wait", "succeeded", "failed", "dead_letter", "cancelled"]).optional(),
  queue: z.string().trim().regex(/^[a-z][a-z0-9._-]{0,79}$/).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(100),
});

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Oturum gerekli." }, { status: 401 });
  const parsed = querySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0]?.message ?? "Geçersiz operasyon filtresi." }, { status: 400 });
  try {
    const organizationId = await requireOrganizationOwner(supabase, user.id, request.headers.get("x-organization-id"));
    let query = supabase.from("operation_jobs").select("id,organization_id,queue,job_type,job_version,status,priority,attempt_count,max_attempts,replay_count,available_at,lease_owner,lease_expires_at,correlation_id,parent_job_id,error_code,error_message,created_by,started_at,completed_at,retention_until,created_at,updated_at").eq("organization_id", organizationId);
    if (parsed.data.status) query = query.eq("status", parsed.data.status);
    if (parsed.data.queue) query = query.eq("queue", parsed.data.queue);
    const { data, error } = await query.order("created_at", { ascending: false }).limit(parsed.data.limit);
    if (error) throw error;
    return Response.json({ organization_id: organizationId, jobs: data });
  } catch (error) {
    return operationError(error);
  }
}

function operationError(error: unknown) {
  if (error instanceof OperationRuntimeError) return Response.json({ error: error.message, code: error.code }, { status: error.code.endsWith("required") ? 403 : 400 });
  return Response.json({ error: "Operasyon işleri okunamadı." }, { status: 500 });
}

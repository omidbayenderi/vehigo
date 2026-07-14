import { requireOrganizationOwner } from "@/lib/operations/authorization";
import { OperationRuntimeError } from "@/lib/operations/runtime";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Oturum gerekli." }, { status: 401 });
  try {
    const organizationId = await requireOrganizationOwner(supabase, user.id, request.headers.get("x-organization-id"));
    const { id } = await params;
    const { data: job, error: lookupError } = await supabase.from("operation_jobs").select("id,organization_id,status").eq("id", id).eq("organization_id", organizationId).single();
    if (lookupError || !job) return Response.json({ error: "Dead-letter işi bulunamadı." }, { status: 404 });
    const { data, error } = await supabase.rpc("replay_dead_letter_operation", { p_job_id: job.id });
    if (error) return Response.json({ error: error.message }, { status: 409 });
    return Response.json({ job: data });
  } catch (error) {
    if (error instanceof OperationRuntimeError) return Response.json({ error: error.message, code: error.code }, { status: 403 });
    return Response.json({ error: "Operasyon replay başarısız." }, { status: 500 });
  }
}

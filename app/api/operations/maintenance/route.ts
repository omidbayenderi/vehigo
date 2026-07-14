import { createAdminClient } from "@/lib/supabase/admin";
import { isOperationsCronAuthorized } from "@/lib/operations/request-auth";

export async function GET(request: Request) {
  return runMaintenance(request);
}

export async function POST(request: Request) {
  return runMaintenance(request);
}

async function runMaintenance(request: Request) {
  if (!isOperationsCronAuthorized(request)) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const startedAt = new Date();
  const { data, error } = await createAdminClient().rpc("run_operational_maintenance");
  if (error) {
    console.error(JSON.stringify({ event: "operational.maintenance.failed", error: error.message, started_at: startedAt.toISOString() }));
    return Response.json({ error: "Operational maintenance failed." }, { status: 500 });
  }
  const durationMs = Date.now() - startedAt.getTime();
  console.info(JSON.stringify({ event: "operational.maintenance.completed", duration_ms: durationMs, result: data }));
  return Response.json({ ok: true, duration_ms: durationMs, result: data });
}

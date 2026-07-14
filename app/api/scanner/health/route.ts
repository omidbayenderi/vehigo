import { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkScannerHealth } from "@/lib/services/scanner-health";
import { isScannerRequestAuthorized } from "@/lib/scanner/request-auth";
import { syncRuntimeConnectorCatalog } from "@/lib/services/source-catalog";

function authorized(request: NextRequest) {
  return isScannerRequestAuthorized(request, ["ingest", "cron"]);
}

export async function GET(request: NextRequest) {
  if (!authorized(request)) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const issues = await checkScannerHealth(createAdminClient());
  return Response.json({ ok: issues.length === 0, checked_at: new Date().toISOString(), issues }, { status: issues.length === 0 ? 200 : 503 });
}

export async function POST(request: NextRequest) {
  if (!isScannerRequestAuthorized(request, ["ingest"])) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const supabase = createAdminClient();
  const synced = await syncRuntimeConnectorCatalog(supabase);
  const issues = await checkScannerHealth(supabase);
  return Response.json({ ok: issues.length === 0, checked_at: new Date().toISOString(), synced, issues }, { status: issues.length === 0 ? 200 : 503 });
}

import { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isScannerRequestAuthorized } from "@/lib/scanner/request-auth";
import { getConnectorCatalogSnapshot, syncRuntimeConnectorCatalog } from "@/lib/services/source-catalog";

export async function GET(request: NextRequest) {
  if (!isScannerRequestAuthorized(request, ["ingest", "cron"])) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const snapshot = await getConnectorCatalogSnapshot(createAdminClient());
  return Response.json({ ok: snapshot.summary.mismatched === 0, ...snapshot });
}

export async function POST(request: NextRequest) {
  if (!isScannerRequestAuthorized(request, ["ingest"])) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const supabase = createAdminClient();
  const synced = await syncRuntimeConnectorCatalog(supabase);
  const snapshot = await getConnectorCatalogSnapshot(supabase);
  return Response.json({ ok: synced.every((result) => result.ok), synced, ...snapshot });
}

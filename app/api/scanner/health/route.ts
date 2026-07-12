import { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkScannerHealth } from "@/lib/services/scanner-health";

function authorized(request: NextRequest) {
  const ingest = process.env.SCANNER_INGEST_SECRET;
  const cron = process.env.CRON_SECRET;
  return Boolean(
    (ingest && request.headers.get("x-scanner-secret") === ingest) ||
    (cron && request.headers.get("authorization") === `Bearer ${cron}`),
  );
}

export async function GET(request: NextRequest) {
  if (!authorized(request)) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const issues = await checkScannerHealth(createAdminClient());
  return Response.json({ ok: issues.length === 0, checked_at: new Date().toISOString(), issues }, { status: issues.length === 0 ? 200 : 503 });
}

export const POST = GET;

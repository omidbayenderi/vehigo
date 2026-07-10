import { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { runScannerOnce } from "@/lib/scanner/runner";

export async function POST(request: NextRequest) {
  const secret = process.env.SCANNER_INGEST_SECRET;
  if (!secret || request.headers.get("x-scanner-secret") !== secret) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  return runScanner(request);
}

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const authorization = request.headers.get("authorization");
  if (!secret || authorization !== `Bearer ${secret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  return runScanner(request);
}

async function runScanner(request: NextRequest) {
  const force = request.nextUrl.searchParams.get("force") === "1";
  const sourceKey = request.nextUrl.searchParams.get("source") ?? undefined;
  const supabase = createAdminClient();
  const summary = await runScannerOnce(supabase, { force, sourceKey });

  return Response.json({ ok: true, force, source_key: sourceKey ?? null, ...summary });
}

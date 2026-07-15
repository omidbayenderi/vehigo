import { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { runScannerOnce } from "@/lib/scanner/runner";
import { isScannerRequestAuthorized } from "@/lib/scanner/request-auth";
import { scannerRunHasCriticalFailures } from "@/lib/scanner/run-health";

export const maxDuration = 240;

export async function POST(request: NextRequest) {
  if (!isScannerRequestAuthorized(request, ["ingest"])) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  return runScanner(request);
}

export async function GET(request: NextRequest) {
  if (!isScannerRequestAuthorized(request, ["cron"])) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  return runScanner(request);
}

async function runScanner(request: NextRequest) {
  const force = request.nextUrl.searchParams.get("force") === "1";
  const sourceKey = request.nextUrl.searchParams.get("source") ?? undefined;
  const supabase = createAdminClient();
  const summary = await runScannerOnce(supabase, { force, sourceKey });
  const degraded = scannerRunHasCriticalFailures(summary);

  return Response.json(
    { ok: !degraded, force, source_key: sourceKey ?? null, ...summary },
    { status: degraded ? 503 : 200 },
  );
}

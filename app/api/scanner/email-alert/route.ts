import { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { parseEmailAlertListings, type EmailAlertPayload } from "@/lib/scanner/email-alert";
import { processIncomingListings, recordScannerRun } from "@/lib/services/market-alerts";

export async function POST(request: NextRequest) {
  const secret = process.env.SCANNER_INGEST_SECRET;
  if (!secret || request.headers.get("x-scanner-secret") !== secret) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const startedAt = new Date();
  const payload = (await request.json()) as EmailAlertPayload;
  if (!payload.source_key || (!payload.text && !payload.html && !payload.subject)) {
    return Response.json({ error: "source_key ve email içeriği gerekli" }, { status: 400 });
  }

  const listings = parseEmailAlertListings(payload);
  const supabase = createAdminClient();

  try {
    const result = await processIncomingListings(supabase, listings);
    const { nextRunAt } = await recordScannerRun(supabase, payload.source_key, startedAt, {
      status: "ok",
      result,
    });

    return Response.json({ ok: true, ...result, next_run_at: nextRunAt });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Bilinmeyen hata";
    await recordScannerRun(supabase, payload.source_key, startedAt, {
      status: "failed",
      error: message,
      fetchedCount: listings.length,
    });
    return Response.json({ error: message }, { status: 500 });
  }
}

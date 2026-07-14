import { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isScannerRequestAuthorized } from "@/lib/scanner/request-auth";
import { replayIngestEvent, ScannerIngestError } from "@/lib/services/scanner-ingest";

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  if (!isScannerRequestAuthorized(request, ["ingest"])) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await context.params;
  try {
    const executed = await replayIngestEvent(createAdminClient(), id);
    return Response.json({ ok: true, replayed: true, event_id: executed.eventId, ...executed.result, next_run_at: executed.nextRunAt });
  } catch (error) {
    const ingestError = error instanceof ScannerIngestError
      ? error
      : new ScannerIngestError("internal_error", 500, "Replay sırasında beklenmeyen hata oluştu", id);
    return Response.json({ error: ingestError.message, code: ingestError.code, event_id: ingestError.eventId }, { status: ingestError.httpStatus });
  }
}

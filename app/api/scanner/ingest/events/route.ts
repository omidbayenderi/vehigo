import { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isScannerRequestAuthorized } from "@/lib/scanner/request-auth";
import type { ScannerIngestEventStatus } from "@/lib/supabase/types";

const STATUSES: ScannerIngestEventStatus[] = ["received", "processing", "completed", "rejected", "failed"];

export async function GET(request: NextRequest) {
  if (!isScannerRequestAuthorized(request, ["ingest", "cron"])) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const requestedStatus = request.nextUrl.searchParams.get("status");
  if (requestedStatus && !STATUSES.includes(requestedStatus as ScannerIngestEventStatus)) {
    return Response.json({ error: "Geçersiz event status filtresi" }, { status: 400 });
  }
  const sourceKey = request.nextUrl.searchParams.get("source");
  const requestedLimit = Number.parseInt(request.nextUrl.searchParams.get("limit") ?? "50", 10);
  const limit = Number.isFinite(requestedLimit) ? Math.max(1, Math.min(requestedLimit, 100)) : 50;

  let query = createAdminClient()
    .from("scanner_ingest_events")
    .select("id,source_key,channel,idempotency_key,payload_hash,status,listing_count,result,attempt_count,error_code,error_message,next_retry_at,processing_started_at,completed_at,payload_expires_at,created_at,updated_at")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (requestedStatus) query = query.eq("status", requestedStatus as ScannerIngestEventStatus);
  if (sourceKey) query = query.eq("source_key", sourceKey);
  const { data, error } = await query;
  if (error) return Response.json({ error: "Ingest event listesi okunamadı" }, { status: 500 });

  return Response.json({ ok: true, count: data?.length ?? 0, events: data ?? [] });
}

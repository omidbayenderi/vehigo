import { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ingestPayloadSchema } from "@/lib/scanner/ingest-validation";
import { isScannerRequestAuthorized } from "@/lib/scanner/request-auth";
import { readBoundedJson, ScannerRequestBodyError } from "@/lib/scanner/request-body";
import {
  assertIngestSource,
  executeIngestEvent,
  registerIngestEvent,
  resolveIdempotencyKey,
  ScannerIngestError,
  sourceKeyFromUnknown,
} from "@/lib/services/scanner-ingest";

export async function POST(request: NextRequest) {
  if (!isScannerRequestAuthorized(request, ["ingest"])) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await readBoundedJson(request);
  } catch (error) {
    if (!(error instanceof ScannerRequestBodyError)) throw error;
    const eventId = await recordRejectedBody(request, error).catch(() => undefined);
    return Response.json({ error: error.message, code: error.code, event_id: eventId }, { status: error.httpStatus });
  }

  let idempotencyKey: string;
  try {
    idempotencyKey = resolveIdempotencyKey(request.headers.get("x-idempotency-key"), body);
  } catch (error) {
    const ingestError = normalizeIngestError(error);
    return ingestErrorResponse(ingestError);
  }
  const parsed = ingestPayloadSchema.safeParse(body);
  if (!parsed.success) {
    const registered = await registerIngestEvent(createAdminClient(), {
      sourceKey: sourceKeyFromUnknown(body),
      channel: "connector",
      idempotencyKey,
      payload: body,
      listingCount: listingCountFromUnknown(body),
      status: "rejected",
      errorCode: "invalid_payload",
      errorMessage: parsed.error.issues.map((issue) => issue.message).join("; "),
    });
    return Response.json(
      { error: "Geçersiz ingest payload", code: "invalid_payload", event_id: registered.event.id, issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const payload = parsed.data;
  const supabase = createAdminClient();
  const listings = payload.listings.map((listing) => ({ ...listing, source_key: payload.source_key }));

  try {
    const source = await assertIngestSource(supabase, payload.source_key, listings);
    const registered = await registerIngestEvent(supabase, {
      sourceKey: payload.source_key,
      channel: "connector",
      idempotencyKey,
      payload,
      listingCount: listings.length,
      retentionDays: source.data_retention_days,
    });
    if (registered.duplicate && registered.event.status === "failed") {
      throw new ScannerIngestError("replay_required", 409, "Başarısız event replay endpoint'i ile yeniden oynatılmalı", registered.event.id);
    }
    const executed = await executeIngestEvent(supabase, registered.event, payload.source_key, listings);
    return Response.json({
      ok: true,
      event_id: executed.eventId,
      duplicate: executed.duplicate || registered.duplicate,
      ...executed.result,
      next_run_at: executed.nextRunAt,
    });
  } catch (error) {
    const ingestError = normalizeIngestError(error);
    if (!ingestError.eventId && ingestError.httpStatus < 500) {
      const registered = await registerIngestEvent(supabase, {
        sourceKey: payload.source_key,
        channel: "connector",
        idempotencyKey,
        payload,
        listingCount: listings.length,
        status: "rejected",
        errorCode: ingestError.code,
        errorMessage: ingestError.message,
      });
      return ingestErrorResponse(ingestError, registered.event.id);
    }
    return ingestErrorResponse(ingestError, ingestError.eventId);
  }
}

async function recordRejectedBody(request: NextRequest, error: ScannerRequestBodyError) {
  const payload = { rejected_body: true, code: error.code };
  const registered = await registerIngestEvent(createAdminClient(), {
    sourceKey: "__unknown__",
    channel: "connector",
    idempotencyKey: resolveIdempotencyKey(request.headers.get("x-idempotency-key"), payload),
    payload,
    listingCount: 0,
    status: "rejected",
    errorCode: error.code,
    errorMessage: error.message,
  });
  return registered.event.id;
}

function listingCountFromUnknown(body: unknown) {
  if (!body || typeof body !== "object" || Array.isArray(body)) return 0;
  const listings = (body as Record<string, unknown>).listings;
  return Array.isArray(listings) ? listings.length : 0;
}

function normalizeIngestError(error: unknown) {
  return error instanceof ScannerIngestError
    ? error
    : new ScannerIngestError("internal_error", 500, "Ingest işleme sırasında beklenmeyen hata oluştu");
}

function ingestErrorResponse(error: ScannerIngestError, eventId?: string) {
  return Response.json({ error: error.message, code: error.code, event_id: eventId }, { status: error.httpStatus });
}

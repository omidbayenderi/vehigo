import { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { emailAlertPayloadSchema, parseEmailAlertListings } from "@/lib/scanner/email-alert";
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
    if (error instanceof ScannerRequestBodyError) {
      const eventId = await recordRejectedBody(request, error).catch(() => undefined);
      return Response.json({ error: error.message, code: error.code, event_id: eventId }, { status: error.httpStatus });
    }
    throw error;
  }

  let idempotencyKey: string;
  try {
    idempotencyKey = resolveIdempotencyKey(request.headers.get("x-idempotency-key"), body);
  } catch (error) {
    const ingestError = error instanceof ScannerIngestError
      ? error
      : new ScannerIngestError("invalid_idempotency_key", 400, "Geçersiz idempotency anahtarı");
    return Response.json({ error: ingestError.message, code: ingestError.code }, { status: ingestError.httpStatus });
  }
  const parsed = emailAlertPayloadSchema.safeParse(body);
  if (!parsed.success) {
    const registered = await registerIngestEvent(createAdminClient(), {
      sourceKey: sourceKeyFromUnknown(body),
      channel: "email_alert",
      idempotencyKey,
      payload: body,
      listingCount: 0,
      status: "rejected",
      errorCode: "invalid_email_payload",
      errorMessage: parsed.error.issues.map((issue) => issue.message).join("; "),
    });
    return Response.json({ error: "Geçersiz email payload", code: "invalid_email_payload", event_id: registered.event.id }, { status: 400 });
  }

  const payload = parsed.data;
  const listings = parseEmailAlertListings(payload);
  const supabase = createAdminClient();

  try {
    if (listings.length === 0) throw new ScannerIngestError("no_listing_urls", 422, "Email içinde geçerli ilan URL'si bulunamadı");
    const source = await assertIngestSource(supabase, payload.source_key, listings);
    const registered = await registerIngestEvent(supabase, {
      sourceKey: payload.source_key,
      channel: "email_alert",
      idempotencyKey,
      payload,
      listingCount: listings.length,
      retentionDays: source.data_retention_days,
    });
    if (registered.duplicate && registered.event.status === "failed") {
      throw new ScannerIngestError("replay_required", 409, "Başarısız event replay endpoint'i ile yeniden oynatılmalı", registered.event.id);
    }
    const executed = await executeIngestEvent(supabase, registered.event, payload.source_key, listings);
    return Response.json({ ok: true, event_id: executed.eventId, duplicate: executed.duplicate || registered.duplicate, ...executed.result, next_run_at: executed.nextRunAt });
  } catch (error) {
    const ingestError = error instanceof ScannerIngestError
      ? error
      : new ScannerIngestError("internal_error", 500, "Email ingest sırasında beklenmeyen hata oluştu");
    if (!ingestError.eventId && ingestError.httpStatus < 500) {
      const registered = await registerIngestEvent(supabase, {
        sourceKey: payload.source_key,
        channel: "email_alert",
        idempotencyKey,
        payload,
        listingCount: listings.length,
        status: "rejected",
        errorCode: ingestError.code,
        errorMessage: ingestError.message,
      });
      return Response.json({ error: ingestError.message, code: ingestError.code, event_id: registered.event.id }, { status: ingestError.httpStatus });
    }
    return Response.json({ error: ingestError.message, code: ingestError.code, event_id: ingestError.eventId }, { status: ingestError.httpStatus });
  }
}

async function recordRejectedBody(request: NextRequest, error: ScannerRequestBodyError) {
  const payload = { rejected_body: true, code: error.code };
  const registered = await registerIngestEvent(createAdminClient(), {
    sourceKey: "__unknown__",
    channel: "email_alert",
    idempotencyKey: resolveIdempotencyKey(request.headers.get("x-idempotency-key"), payload),
    payload,
    listingCount: 0,
    status: "rejected",
    errorCode: error.code,
    errorMessage: error.message,
  });
  return registered.event.id;
}

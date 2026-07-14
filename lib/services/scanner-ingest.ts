import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json, ScannerIngestChannel } from "@/lib/supabase/types";
import type { MarketListingInput } from "@/lib/domain/listings";
import { ingestPayloadSchema, findSourceUrlMismatch } from "@/lib/scanner/ingest-validation";
import { emailAlertPayloadSchema, parseEmailAlertListings } from "@/lib/scanner/email-alert";
import { processIncomingListings, recordScannerRun, type ProcessListingsResult } from "@/lib/services/market-alerts";
import { serviceOrganizationId } from "@/lib/operations/runtime";

type Client = SupabaseClient<Database>;
type IngestEvent = Database["public"]["Tables"]["scanner_ingest_events"]["Row"];

const MAX_ATTEMPTS = 5;
const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9._:-]{1,128}$/;

export class ScannerIngestError extends Error {
  constructor(
    public readonly code: string,
    public readonly httpStatus: number,
    message: string,
    public readonly eventId?: string,
  ) {
    super(message);
  }
}

export type ExecuteIngestResult = {
  eventId: string;
  duplicate: boolean;
  result: ProcessListingsResult;
  nextRunAt: string | null;
};

export function payloadHash(payload: unknown) {
  return createHash("sha256").update(stableJson(payload)).digest("hex");
}

export function resolveIdempotencyKey(headerValue: string | null, payload: unknown) {
  const supplied = headerValue?.trim();
  if (supplied) {
    if (!IDEMPOTENCY_KEY_PATTERN.test(supplied)) {
      throw new ScannerIngestError("invalid_idempotency_key", 400, "Geçersiz idempotency anahtarı");
    }
    return supplied;
  }
  return `sha256:${payloadHash(payload)}`;
}

export function sourceKeyFromUnknown(payload: unknown) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return "__unknown__";
  const value = (payload as Record<string, unknown>).source_key;
  return typeof value === "string" && value.trim() ? value.trim().slice(0, 120) : "__unknown__";
}

export async function registerIngestEvent(
  supabase: Client,
  input: {
    sourceKey: string;
    channel: ScannerIngestChannel;
    idempotencyKey: string;
    payload: unknown;
    listingCount: number;
    status?: "received" | "rejected";
    errorCode?: string;
    errorMessage?: string;
    retentionDays?: number;
    organizationId?: string;
  },
) {
  const organizationId = await serviceOrganizationId(supabase, input.organizationId);
  const hash = payloadHash(input.payload);
  const expiresAt = new Date(Date.now() + Math.max(1, Math.min(input.retentionDays ?? 30, 365)) * 86_400_000).toISOString();
  const row: Database["public"]["Tables"]["scanner_ingest_events"]["Insert"] = {
    source_key: input.sourceKey,
    organization_id: organizationId,
    channel: input.channel,
    idempotency_key: input.idempotencyKey,
    payload_hash: hash,
    payload: input.status === "rejected" ? null : toJson(input.payload),
    listing_count: input.listingCount,
    status: input.status ?? "received",
    error_code: input.errorCode,
    error_message: sanitizeErrorMessage(input.errorMessage),
    payload_expires_at: expiresAt,
  };

  const { data, error } = await supabase.from("scanner_ingest_events").insert(row).select().maybeSingle();
  if (!error && data) return { event: data, duplicate: false };
  if (error?.code !== "23505") throw new ScannerIngestError("event_registration_failed", 500, "Ingest event kaydedilemedi");

  const { data: existing, error: existingError } = await supabase
    .from("scanner_ingest_events")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("source_key", input.sourceKey)
    .eq("idempotency_key", input.idempotencyKey)
    .single();
  if (existingError) throw new ScannerIngestError("event_lookup_failed", 500, "Mevcut ingest event okunamadı");
  if (existing.payload_hash !== hash) {
    throw new ScannerIngestError("idempotency_conflict", 409, "Aynı idempotency anahtarı farklı bir payload için kullanılmış", existing.id);
  }
  return { event: existing, duplicate: true };
}

export async function executeIngestEvent(
  supabase: Client,
  event: IngestEvent,
  sourceKey: string,
  listings: MarketListingInput[],
): Promise<ExecuteIngestResult> {
  if (event.status === "completed") return completedDuplicate(event);
  if (event.status === "processing") {
    throw new ScannerIngestError("already_processing", 409, "Bu ingest event halen işleniyor", event.id);
  }
  if (event.status === "rejected") {
    throw new ScannerIngestError("event_rejected", 409, "Reddedilmiş event düzeltilmeden işlenemez", event.id);
  }
  if (event.attempt_count >= MAX_ATTEMPTS) {
    throw new ScannerIngestError("retry_limit_reached", 409, "Ingest event yeniden deneme sınırına ulaştı", event.id);
  }

  const attemptCount = event.attempt_count + 1;
  const { data: claimed, error: claimError } = await supabase
    .from("scanner_ingest_events")
    .update({
      status: "processing",
      attempt_count: attemptCount,
      processing_started_at: new Date().toISOString(),
      error_code: null,
      error_message: null,
      next_retry_at: null,
    })
    .eq("id", event.id)
    .in("status", ["received", "failed"])
    .select()
    .maybeSingle();
  if (claimError) throw new ScannerIngestError("event_claim_failed", 500, "Ingest event işleme alınamadı", event.id);
  if (!claimed) throw new ScannerIngestError("event_claim_conflict", 409, "Ingest event başka bir worker tarafından alındı", event.id);

  const startedAt = new Date();
  try {
    const result = await processIncomingListings(supabase, listings);
    const { nextRunAt } = await recordScannerRun(supabase, sourceKey, startedAt, { status: "ok", result });
    const storedResult = { ...result, next_run_at: nextRunAt } as unknown as Json;
    const { error: completeError } = await supabase
      .from("scanner_ingest_events")
      .update({
        status: "completed",
        result: storedResult,
        payload: null,
        payload_expires_at: new Date().toISOString(),
        completed_at: new Date().toISOString(),
      })
      .eq("id", event.id);
    if (completeError) throw new Error(`Event completion failed: ${completeError.message}`);
    return { eventId: event.id, duplicate: false, result, nextRunAt };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Bilinmeyen ingest hatası";
    await recordScannerRun(supabase, sourceKey, startedAt, {
      status: "failed",
      error: message,
      fetchedCount: listings.length,
    }).catch(() => undefined);
    await supabase
      .from("scanner_ingest_events")
      .update({
        status: "failed",
        error_code: "processing_failed",
        error_message: sanitizeErrorMessage(message),
        next_retry_at: attemptCount < MAX_ATTEMPTS ? nextRetryAt(attemptCount) : null,
      })
      .eq("id", event.id);
    throw new ScannerIngestError("processing_failed", 500, "Ingest işleme başarısız oldu", event.id);
  }
}

export async function replayIngestEvent(supabase: Client, eventId: string) {
  const { data: event, error } = await supabase.from("scanner_ingest_events").select("*").eq("id", eventId).maybeSingle();
  if (error) throw new ScannerIngestError("event_lookup_failed", 500, "Ingest event okunamadı", eventId);
  if (!event) throw new ScannerIngestError("event_not_found", 404, "Ingest event bulunamadı", eventId);
  if (event.status !== "failed") throw new ScannerIngestError("event_not_replayable", 409, "Yalnız başarısız event yeniden oynatılabilir", eventId);
  if (!event.payload) throw new ScannerIngestError("payload_expired", 410, "Event payload saklama süresi dolmuş", eventId);

  const payload = event.payload;
  let sourceKey: string;
  let listings: MarketListingInput[];
  if (event.channel === "email_alert") {
    const parsed = emailAlertPayloadSchema.safeParse(payload);
    if (!parsed.success) throw new ScannerIngestError("stored_payload_invalid", 409, "Saklanan email payload artık geçerli değil", eventId);
    sourceKey = parsed.data.source_key;
    listings = parseEmailAlertListings(parsed.data);
  } else {
    const parsed = ingestPayloadSchema.safeParse(payload);
    if (!parsed.success) throw new ScannerIngestError("stored_payload_invalid", 409, "Saklanan connector payload artık geçerli değil", eventId);
    sourceKey = parsed.data.source_key;
    listings = parsed.data.listings.map((listing) => ({ ...listing, source_key: sourceKey }));
  }

  await assertIngestSource(supabase, sourceKey, listings);
  return executeIngestEvent(supabase, event, sourceKey, listings);
}

export async function replayDueIngestEvents(supabase: Client, limit = 10) {
  const { data: events, error } = await supabase
    .from("scanner_ingest_events")
    .select("id")
    .eq("status", "failed")
    .not("next_retry_at", "is", null)
    .lte("next_retry_at", new Date().toISOString())
    .lt("attempt_count", MAX_ATTEMPTS)
    .order("next_retry_at", { ascending: true })
    .limit(Math.max(1, Math.min(limit, 50)));
  if (error) throw new ScannerIngestError("replay_queue_failed", 500, "Replay kuyruğu okunamadı");

  let replayed = 0;
  let failed = 0;
  for (const event of events ?? []) {
    try {
      await replayIngestEvent(supabase, event.id);
      replayed++;
    } catch (replayError) {
      failed++;
      const message = replayError instanceof Error ? replayError.message : "Otomatik replay başarısız";
      await supabase.from("scanner_ingest_events").update({
        error_message: sanitizeErrorMessage(message),
        next_retry_at: new Date(Date.now() + 6 * 60 * 60_000).toISOString(),
      }).eq("id", event.id);
    }
  }
  return { replayed, failed };
}

export async function assertIngestSource(supabase: Client, sourceKey: string, listings: Array<{ listing_url: string }>) {
  const { data: source, error } = await supabase
    .from("market_sources")
    .select("key,base_url,enabled,data_retention_days")
    .eq("key", sourceKey)
    .maybeSingle();
  if (error) throw new ScannerIngestError("source_lookup_failed", 500, "Kaynak doğrulanamadı");
  if (!source) throw new ScannerIngestError("unknown_source", 404, "Bilinmeyen arama kaynağı");
  if (!source.enabled) throw new ScannerIngestError("source_disabled", 409, "Arama kaynağı aktif değil");
  const mismatchIndex = findSourceUrlMismatch(listings, source);
  if (mismatchIndex !== null) {
    throw new ScannerIngestError("source_url_mismatch", 400, `İlan URL alan adı kaynakla eşleşmiyor (index ${mismatchIndex})`);
  }
  return source;
}

function completedDuplicate(event: IngestEvent): ExecuteIngestResult {
  const result = event.result && typeof event.result === "object" && !Array.isArray(event.result)
    ? event.result as Record<string, Json>
    : {};
  return {
    eventId: event.id,
    duplicate: true,
    result: {
      fetched: numericResult(result.fetched),
      inserted: numericResult(result.inserted),
      alertsCreated: numericResult(result.alertsCreated),
      alertsSent: numericResult(result.alertsSent),
      alertsFailed: numericResult(result.alertsFailed),
    },
    nextRunAt: typeof result.next_run_at === "string" ? result.next_run_at : null,
  };
}

function nextRetryAt(attempt: number) {
  const delayMinutes = Math.min(360, 2 ** Math.max(0, attempt - 1) * 5);
  return new Date(Date.now() + delayMinutes * 60_000).toISOString();
}

function numericResult(value: Json | undefined) {
  return typeof value === "number" ? value : 0;
}

function sanitizeErrorMessage(value?: string) {
  if (!value) return null;
  return value.replace(/[\r\n\t]+/g, " ").slice(0, 1_000);
}

function toJson(value: unknown): Json {
  return JSON.parse(JSON.stringify(value)) as Json;
}

function stableJson(value: unknown): string {
  if (value === undefined) return "null";
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  const object = value as Record<string, unknown>;
  return `{${Object.keys(object).sort().map((key) => `${JSON.stringify(key)}:${stableJson(object[key])}`).join(",")}}`;
}

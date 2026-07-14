import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json, OperationEventLevel } from "@/lib/supabase/types";

type Client = SupabaseClient<Database>;
type OperationJob = Database["public"]["Tables"]["operation_jobs"]["Row"];

const KEY_PATTERN = /^[A-Za-z0-9._:-]{1,160}$/;
const NAME_PATTERN = /^[a-z][a-z0-9._-]{0,119}$/;

export class OperationRuntimeError extends Error {
  constructor(public readonly code: string, message: string, public readonly jobId?: string) {
    super(message);
  }
}

export function operationPayloadHash(payload: unknown) {
  return createHash("sha256").update(stableJson(payload)).digest("hex");
}

export function operationIdempotencyKey(value: string | undefined, payload: unknown) {
  const key = value?.trim() || `sha256:${operationPayloadHash(payload)}`;
  if (!KEY_PATTERN.test(key)) throw new OperationRuntimeError("invalid_idempotency_key", "Geçersiz operasyon idempotency anahtarı.");
  return key;
}

export async function primaryOrganizationId(supabase: Client, userId: string) {
  const { data, error } = await supabase
    .from("organization_members")
    .select("organization_id")
    .eq("user_id", userId)
    .eq("status", "active")
    .order("joined_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw new OperationRuntimeError("organization_lookup_failed", "Organizasyon bağlamı okunamadı.");
  if (!data) throw new OperationRuntimeError("organization_required", "Aktif organizasyon üyeliği gerekli.");
  return data.organization_id;
}

export async function serviceOrganizationId(supabase: Client, explicitOrganizationId?: string) {
  if (explicitOrganizationId) return explicitOrganizationId;
  const { data, error } = await supabase.from("organizations").select("id").eq("status", "active").order("created_at").limit(2);
  if (error) throw new OperationRuntimeError("organization_lookup_failed", "Servis organizasyon bağlamı okunamadı.");
  if (data.length !== 1) throw new OperationRuntimeError("organization_required", "Birden fazla organizasyonda servis çağrısı açık organization ID taşımalıdır.");
  return data[0].id;
}

export async function enqueueOperation(supabase: Client, input: {
  organizationId: string;
  queue: string;
  jobType: string;
  payload: unknown;
  idempotencyKey?: string;
  jobVersion?: number;
  priority?: number;
  maxAttempts?: number;
  retryBaseSeconds?: number;
  retryCapSeconds?: number;
  availableAt?: string;
  retentionDays?: number;
  correlationId?: string;
  parentJobId?: string;
  createdBy?: string;
}) {
  const queue = validateName(input.queue, "queue", 80);
  const jobType = validateName(input.jobType, "job_type", 120);
  const payload = toJson(input.payload);
  const hash = operationPayloadHash(payload);
  const idempotencyKey = operationIdempotencyKey(input.idempotencyKey, payload);
  const retentionDays = clamp(input.retentionDays ?? 30, 1, 3650);
  const row: Database["public"]["Tables"]["operation_jobs"]["Insert"] = {
    organization_id: input.organizationId,
    queue,
    job_type: jobType,
    job_version: clamp(input.jobVersion ?? 1, 1, 100_000),
    idempotency_key: idempotencyKey,
    payload_hash: hash,
    payload,
    priority: clamp(input.priority ?? 50, 0, 100),
    max_attempts: clamp(input.maxAttempts ?? 5, 1, 1_000),
    retry_base_seconds: clamp(input.retryBaseSeconds ?? 30, 1, 86_400),
    retry_cap_seconds: clamp(input.retryCapSeconds ?? 21_600, 1, 604_800),
    available_at: input.availableAt ?? new Date().toISOString(),
    retention_until: new Date(Date.now() + retentionDays * 86_400_000).toISOString(),
    correlation_id: input.correlationId,
    parent_job_id: input.parentJobId,
    created_by: input.createdBy,
  };
  if ((row.retry_cap_seconds ?? 0) < (row.retry_base_seconds ?? 0)) throw new OperationRuntimeError("invalid_retry_policy", "Retry üst sınırı başlangıç gecikmesinden küçük olamaz.");

  const { data, error } = await supabase.from("operation_jobs").insert(row).select("*").maybeSingle();
  if (!error && data) return { job: data, duplicate: false };
  if (error?.code !== "23505") throw new OperationRuntimeError("enqueue_failed", "Operasyon kuyruğa alınamadı.");

  const { data: existing, error: lookupError } = await supabase
    .from("operation_jobs")
    .select("*")
    .eq("organization_id", input.organizationId)
    .eq("queue", queue)
    .eq("idempotency_key", idempotencyKey)
    .single();
  if (lookupError) throw new OperationRuntimeError("idempotency_lookup_failed", "Mevcut operasyon okunamadı.");
  if (existing.payload_hash !== hash) throw new OperationRuntimeError("idempotency_conflict", "Aynı idempotency anahtarı farklı payload için kullanılmış.", existing.id);
  return { job: existing, duplicate: true };
}

export async function claimOperationJobs(supabase: Client, workerId: string, queues: string[], options?: { limit?: number; leaseSeconds?: number }) {
  const normalizedQueues = [...new Set(queues.map((queue) => validateName(queue, "queue", 80)))];
  if (!workerId.trim() || !normalizedQueues.length) throw new OperationRuntimeError("invalid_worker", "Worker ve en az bir queue gerekli.");
  const { data, error } = await supabase.rpc("claim_operation_jobs", { p_worker_id: workerId.trim().slice(0, 160), p_queues: normalizedQueues, p_limit: clamp(options?.limit ?? 10, 1, 100), p_lease_seconds: clamp(options?.leaseSeconds ?? 120, 15, 3600) });
  if (error) throw new OperationRuntimeError("claim_failed", "Operasyon işleri lease edilemedi.");
  return data ?? [];
}

export async function heartbeatOperationJob(supabase: Client, job: Pick<OperationJob, "id" | "lease_token">, extendSeconds = 120) {
  if (!job.lease_token) throw new OperationRuntimeError("lease_required", "Aktif lease token gerekli.", job.id);
  const { data, error } = await supabase.rpc("heartbeat_operation_job", { p_job_id: job.id, p_lease_token: job.lease_token, p_extend_seconds: clamp(extendSeconds, 15, 3600) });
  if (error || !data) throw new OperationRuntimeError("lease_lost", "Operasyon lease süresi doldu veya başka worker tarafından alındı.", job.id);
  return true;
}

export async function completeOperationJob(supabase: Client, job: Pick<OperationJob, "id" | "lease_token">, result: unknown = {}, metrics: unknown = {}) {
  if (!job.lease_token) throw new OperationRuntimeError("lease_required", "Aktif lease token gerekli.", job.id);
  const { data, error } = await supabase.rpc("complete_operation_job", { p_job_id: job.id, p_lease_token: job.lease_token, p_result: toJson(result), p_metrics: toJson(metrics) });
  if (error) throw new OperationRuntimeError("complete_failed", "Operasyon tamamlanamadı; lease geçersiz olabilir.", job.id);
  return data;
}

export async function failOperationJob(supabase: Client, job: Pick<OperationJob, "id" | "lease_token">, error: unknown, options?: { retryable?: boolean; code?: string; metrics?: unknown }) {
  if (!job.lease_token) throw new OperationRuntimeError("lease_required", "Aktif lease token gerekli.", job.id);
  const normalized = normalizeOperationError(error, options?.code);
  const { data, error: rpcError } = await supabase.rpc("fail_operation_job", { p_job_id: job.id, p_lease_token: job.lease_token, p_error_code: normalized.code, p_error_message: normalized.message, p_retryable: options?.retryable ?? true, p_metrics: toJson(options?.metrics ?? {}) });
  if (rpcError) throw new OperationRuntimeError("failure_record_failed", "Operasyon hatası kaydedilemedi; lease geçersiz olabilir.", job.id);
  return data;
}

export async function recordOperationEvent(supabase: Client, input: { organizationId: string; correlationId: string; level: OperationEventLevel; eventType: string; message: string; jobId?: string; attributes?: unknown; retentionUntil?: string }) {
  const message = sanitize(input.message, 2_000);
  if (!message) throw new OperationRuntimeError("event_message_required", "Operasyon event mesajı gerekli.");
  const { error } = await supabase.from("operation_events").insert({ organization_id: input.organizationId, job_id: input.jobId, correlation_id: input.correlationId, level: input.level, event_type: sanitize(input.eventType, 120), message, attributes: toJson(input.attributes ?? {}), retention_until: input.retentionUntil });
  if (error) throw new OperationRuntimeError("event_write_failed", "Operasyon event’i kaydedilemedi.", input.jobId);
}

export function normalizeOperationError(error: unknown, fallbackCode = "operation_failed") {
  const code = sanitize(fallbackCode, 120).replace(/[^a-zA-Z0-9._-]/g, "_") || "operation_failed";
  const message = sanitize(error instanceof Error ? error.message : String(error || "Operation failed."), 2_000) || "Operation failed.";
  return { code, message };
}

function validateName(value: string, field: string, max: number) {
  const normalized = value.trim();
  if (normalized.length > max || !NAME_PATTERN.test(normalized)) throw new OperationRuntimeError(`invalid_${field}`, `Geçersiz ${field} değeri.`);
  return normalized;
}

function sanitize(value: string, max: number) { return value.replace(/[\r\n\t]+/g, " ").trim().slice(0, max); }
function clamp(value: number, min: number, max: number) { return Math.max(min, Math.min(max, Math.trunc(value))); }
function toJson(value: unknown): Json { return JSON.parse(JSON.stringify(value ?? null)) as Json; }

function stableJson(value: unknown): string {
  if (value === undefined || value === null) return "null";
  if (typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  const object = value as Record<string, unknown>;
  return `{${Object.keys(object).sort().map((key) => `${JSON.stringify(key)}:${stableJson(object[key])}`).join(",")}}`;
}

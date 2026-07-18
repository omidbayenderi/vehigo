import { createHmac } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

type Client = SupabaseClient<Database>;

export type TransientReceiptCandidate = {
  organizationId: string;
  userId: string;
  sourceKey: string;
  sourceIdentity: string;
};

type ClaimedReceipt = {
  organization_id: string;
  user_id: string;
  source_key: string;
  receipt_hash: string;
};

export type ReceiptClaim = TransientReceiptCandidate & {
  receiptHash: string;
  claimKey: string;
};

export function transientReceiptHash(candidate: TransientReceiptCandidate) {
  return createHmac("sha256", receiptSecret())
    .update("vehigo:transient-delivery:v1\0")
    .update(candidate.sourceKey)
    .update("\0")
    .update(candidate.sourceIdentity)
    .digest("hex");
}

export async function claimTransientDeliveryReceipts(
  supabase: Client,
  candidates: TransientReceiptCandidate[],
  now = new Date(),
) {
  if (candidates.length === 0) return new Map<string, ReceiptClaim>();
  const expiresAt = new Date(now.getTime() + receiptRetentionDays() * 86_400_000).toISOString();
  const uniqueClaims = new Map<string, ReceiptClaim>();

  for (const candidate of candidates) {
    const receiptHash = transientReceiptHash(candidate);
    const claimKey = receiptClaimKey(candidate, receiptHash);
    uniqueClaims.set(claimKey, { ...candidate, receiptHash, claimKey });
  }

  const { error: purgeError } = await supabase
    .from("transient_delivery_receipts")
    .delete()
    .lt("expires_at", now.toISOString());
  if (purgeError) throw new Error(`Teslimat izi temizlenemedi: ${purgeError.message}`);

  const staleBefore = new Date(now.getTime() - receiptClaimMinutes() * 60_000).toISOString();
  const { error: staleClaimError } = await supabase
    .from("transient_delivery_receipts")
    .delete()
    .eq("status", "pending")
    .lt("claimed_at", staleBefore);
  if (staleClaimError) throw new Error(`Eski teslimat ayrımı temizlenemedi: ${staleClaimError.message}`);

  const rows = [...uniqueClaims.values()].map((claim) => ({
    organization_id: claim.organizationId,
    user_id: claim.userId,
    source_key: claim.sourceKey,
    receipt_hash: claim.receiptHash,
    status: "pending" as const,
    claimed_at: now.toISOString(),
    expires_at: expiresAt,
    updated_at: now.toISOString(),
  }));
  const { data, error } = await supabase
    .from("transient_delivery_receipts")
    .upsert(rows, {
      onConflict: "organization_id,user_id,source_key,receipt_hash",
      ignoreDuplicates: true,
    })
    .select("organization_id,user_id,source_key,receipt_hash");
  if (error) throw new Error(`Teslimat izi ayrılamadı: ${error.message}`);

  const claimed = new Map<string, ReceiptClaim>();
  for (const row of (data ?? []) as ClaimedReceipt[]) {
    const key = receiptClaimKey({
      organizationId: row.organization_id,
      userId: row.user_id,
      sourceKey: row.source_key,
    }, row.receipt_hash);
    const claim = uniqueClaims.get(key);
    if (claim) claimed.set(key, claim);
  }
  return claimed;
}

export async function completeTransientDeliveryReceipts(
  supabase: Client,
  userId: string,
  claims: ReceiptClaim[],
  now = new Date(),
) {
  if (claims.length === 0) return;
  const { error } = await supabase
    .from("transient_delivery_receipts")
    .update({ status: "sent", notified_at: now.toISOString(), updated_at: now.toISOString() })
    .eq("user_id", userId)
    .eq("status", "pending")
    .in("receipt_hash", claims.map((claim) => claim.receiptHash));
  if (error) throw new Error(`Teslimat izi tamamlanamadı: ${error.message}`);
}

export async function releaseTransientDeliveryReceipts(
  supabase: Client,
  userId: string,
  claims: ReceiptClaim[],
) {
  if (claims.length === 0) return;
  const { error } = await supabase
    .from("transient_delivery_receipts")
    .delete()
    .eq("user_id", userId)
    .eq("status", "pending")
    .in("receipt_hash", claims.map((claim) => claim.receiptHash));
  if (error) throw new Error(`Başarısız teslimat izi bırakılamadı: ${error.message}`);
}

export function receiptClaimKey(
  candidate: Pick<TransientReceiptCandidate, "organizationId" | "userId" | "sourceKey">,
  receiptHash: string,
) {
  return `${candidate.organizationId}:${candidate.userId}:${candidate.sourceKey}:${receiptHash}`;
}

function receiptSecret() {
  const secret = process.env.DELIVERY_RECEIPT_HMAC_SECRET ?? process.env.SCANNER_INGEST_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("DELIVERY_RECEIPT_HMAC_SECRET veya SCANNER_INGEST_SECRET en az 32 karakter olmalı");
  }
  return secret;
}

function receiptRetentionDays() {
  const parsed = Number.parseInt(process.env.DELIVERY_RECEIPT_RETENTION_DAYS ?? "90", 10);
  if (!Number.isFinite(parsed)) return 90;
  return Math.min(365, Math.max(1, parsed));
}

function receiptClaimMinutes() {
  const parsed = Number.parseInt(process.env.DELIVERY_RECEIPT_CLAIM_MINUTES ?? "15", 10);
  if (!Number.isFinite(parsed)) return 15;
  return Math.min(60, Math.max(5, parsed));
}

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  claimTransientDeliveryReceipts,
  transientReceiptHash,
} from "@/lib/services/transient-delivery-receipts";

const candidate = {
  organizationId: "00000000-0000-4000-8000-000000000001",
  userId: "00000000-0000-4000-8000-000000000002",
  sourceKey: "brave_web",
  sourceIdentity: "https://example.com/listing/123",
};

describe("transient delivery receipts", () => {
  beforeEach(() => {
    vi.stubEnv("DELIVERY_RECEIPT_HMAC_SECRET", "a-secure-test-secret-that-is-over-32-characters");
    vi.stubEnv("DELIVERY_RECEIPT_RETENTION_DAYS", "90");
  });

  afterEach(() => vi.unstubAllEnvs());

  it("creates a deterministic HMAC without exposing the source identity", () => {
    const hash = transientReceiptHash(candidate);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hash).toBe(transientReceiptHash(candidate));
    expect(hash).not.toContain("example.com");
    expect(transientReceiptHash({ ...candidate, sourceIdentity: `${candidate.sourceIdentity}-other` })).not.toBe(hash);
  });

  it("persists only receipt metadata and returns newly inserted claims", async () => {
    const insertedRows: Array<Record<string, unknown>> = [];
    const from = vi.fn(() => ({
      delete: vi.fn(() => ({
        lt: vi.fn(async () => ({ error: null })),
        eq: vi.fn(() => ({ lt: vi.fn(async () => ({ error: null })) })),
      })),
      upsert: vi.fn((rows: Array<Record<string, unknown>>) => {
        insertedRows.push(...rows);
        return { select: vi.fn(async () => ({ data: rows, error: null })) };
      }),
    }));

    const claims = await claimTransientDeliveryReceipts(
      { from } as never,
      [candidate],
      new Date("2026-07-18T12:00:00.000Z"),
    );

    expect(claims.size).toBe(1);
    expect(insertedRows).toHaveLength(1);
    expect(insertedRows[0]).not.toHaveProperty("sourceIdentity");
    expect(insertedRows[0]).not.toHaveProperty("listing_url");
    expect(insertedRows[0]).not.toHaveProperty("title");
    expect(insertedRows[0]).not.toHaveProperty("price");
    expect(insertedRows[0]).toMatchObject({
      organization_id: candidate.organizationId,
      user_id: candidate.userId,
      source_key: candidate.sourceKey,
      status: "pending",
      expires_at: "2026-10-16T12:00:00.000Z",
    });
  });
});

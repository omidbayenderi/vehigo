import { afterEach, describe, expect, it } from "vitest";
import { emailAlertPayloadSchema } from "@/lib/scanner/email-alert";
import { isScannerRequestAuthorized } from "@/lib/scanner/request-auth";
import { MAX_SCANNER_REQUEST_BYTES, readBoundedJson, ScannerRequestBodyError } from "@/lib/scanner/request-body";
import {
  payloadHash,
  resolveIdempotencyKey,
  ScannerIngestError,
  sourceKeyFromUnknown,
} from "@/lib/services/scanner-ingest";

const ORIGINAL_INGEST_SECRET = process.env.SCANNER_INGEST_SECRET;
const ORIGINAL_CRON_SECRET = process.env.CRON_SECRET;

afterEach(() => {
  restoreEnv("SCANNER_INGEST_SECRET", ORIGINAL_INGEST_SECRET);
  restoreEnv("CRON_SECRET", ORIGINAL_CRON_SECRET);
});

describe("scanner ingest lifecycle boundaries", () => {
  it("derives the same payload hash regardless of object key order", () => {
    expect(payloadHash({ source_key: "mobile_de", listings: [{ price: 10, id: "1" }] }))
      .toBe(payloadHash({ listings: [{ id: "1", price: 10 }], source_key: "mobile_de" }));
  });

  it("uses a valid caller idempotency key and rejects unsafe keys", () => {
    expect(resolveIdempotencyKey("n8n:mobile:2026-07-13T10.00", {})).toBe("n8n:mobile:2026-07-13T10.00");
    expect(resolveIdempotencyKey(null, { id: 1 })).toMatch(/^sha256:[a-f0-9]{64}$/);
    expect(() => resolveIdempotencyKey("contains spaces", {})).toThrowError(ScannerIngestError);
  });

  it("extracts a bounded source identity from untrusted payloads", () => {
    expect(sourceKeyFromUnknown({ source_key: "mobile_de" })).toBe("mobile_de");
    expect(sourceKeyFromUnknown({ source_key: 123 })).toBe("__unknown__");
    expect(sourceKeyFromUnknown(null)).toBe("__unknown__");
  });

  it("accepts valid bounded JSON and rejects invalid, empty, or oversized bodies", async () => {
    await expect(readBoundedJson(new Request("https://vehigo.test", {
      method: "POST",
      body: JSON.stringify({ source_key: "mobile_de" }),
    }))).resolves.toEqual({ source_key: "mobile_de" });

    await expect(readBoundedJson(new Request("https://vehigo.test", { method: "POST", body: "{" })))
      .rejects.toMatchObject({ code: "invalid_json", httpStatus: 400 } satisfies Partial<ScannerRequestBodyError>);
    await expect(readBoundedJson(new Request("https://vehigo.test", { method: "POST", body: " " })))
      .rejects.toMatchObject({ code: "empty_body" });
    await expect(readBoundedJson(new Request("https://vehigo.test", {
      method: "POST",
      body: "{}",
      headers: { "content-length": String(MAX_SCANNER_REQUEST_BYTES + 1) },
    }))).rejects.toMatchObject({ code: "body_too_large", httpStatus: 413 });
  });

  it("authenticates scanner requests without accepting missing credentials", () => {
    process.env.SCANNER_INGEST_SECRET = "ingest-test-secret";
    process.env.CRON_SECRET = "cron-test-secret";
    expect(isScannerRequestAuthorized(new Request("https://vehigo.test", {
      headers: { "x-scanner-secret": "ingest-test-secret" },
    }), ["ingest"])).toBe(true);
    expect(isScannerRequestAuthorized(new Request("https://vehigo.test", {
      headers: { authorization: "Bearer cron-test-secret" },
    }), ["cron"])).toBe(true);
    expect(isScannerRequestAuthorized(new Request("https://vehigo.test"), ["ingest", "cron"])).toBe(false);
  });

  it("validates saved-search email payloads and rejects undeclared fields", () => {
    expect(emailAlertPayloadSchema.safeParse({ source_key: "mobile_de", subject: "New listing", text: "https://mobile.de/1" }).success).toBe(true);
    expect(emailAlertPayloadSchema.safeParse({ source_key: "mobile_de" }).success).toBe(false);
    expect(emailAlertPayloadSchema.safeParse({ source_key: "mobile_de", text: "x", secret: "unexpected" }).success).toBe(false);
  });
});

function restoreEnv(key: string, value: string | undefined) {
  if (value === undefined) delete process.env[key];
  else process.env[key] = value;
}

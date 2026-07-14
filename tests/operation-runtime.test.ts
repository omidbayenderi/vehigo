import { describe, expect, it } from "vitest";
import { normalizeOperationError, operationIdempotencyKey, operationPayloadHash, OperationRuntimeError } from "@/lib/operations/runtime";

describe("operation runtime contracts", () => {
  it("hashes semantically identical object payloads deterministically", () => {
    expect(operationPayloadHash({ source: "mobile_de", filters: { year: 2021, brands: ["Volvo"] } }))
      .toBe(operationPayloadHash({ filters: { brands: ["Volvo"], year: 2021 }, source: "mobile_de" }));
  });

  it("derives a valid idempotency key when callers omit one", () => {
    expect(operationIdempotencyKey(undefined, { listingId: "abc" })).toMatch(/^sha256:[0-9a-f]{64}$/);
  });

  it("rejects unsafe caller idempotency keys", () => {
    expect(() => operationIdempotencyKey("spaces are unsafe", {})).toThrowError(OperationRuntimeError);
  });

  it("sanitizes operational errors before persistence", () => {
    expect(normalizeOperationError(new Error("provider\nsecret\tfailed"), "provider timeout")).toEqual({ code: "provider_timeout", message: "provider secret failed" });
  });
});

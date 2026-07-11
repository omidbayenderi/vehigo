import { describe, expect, it } from "vitest";
import { formDataToObject } from "@/lib/utils";
import { listingDecisionSchema, watchlistSchema } from "@/lib/validation/schemas";

describe("watchlist form validation", () => {
  it("preserves repeated marketplace checkbox values", () => {
    const form = new FormData();
    form.append("name", "Avrupa otomobil");
    form.append("source_keys", "marktplaats");
    form.append("source_keys", "brave_web");
    form.append("vehicle_type", "car");

    const result = watchlistSchema.parse(formDataToObject(form));
    expect(result.source_keys).toEqual(["marktplaats", "brave_web"]);
    expect(result.vehicle_type).toBe("car");
  });
});

describe("opportunity decision validation", () => {
  it("accepts a rejection with a useful learning reason", () => {
    expect(listingDecisionSchema.parse({ decision_status: "rejected", decision_reason: "too_expensive" }))
      .toEqual({ decision_status: "rejected", decision_reason: "too_expensive" });
  });

  it("rejects unknown decision reasons", () => {
    expect(() => listingDecisionSchema.parse({ decision_status: "rejected", decision_reason: "random" })).toThrow();
  });
});

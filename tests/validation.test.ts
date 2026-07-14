import { describe, expect, it } from "vitest";
import { formDataToObject } from "@/lib/utils";
import { listingDecisionSchema, watchlistSchema } from "@/lib/validation/schemas";

describe("watchlist form validation", () => {
  it("preserves repeated marketplace checkbox values", () => {
    const form = new FormData();
    form.append("name", "Avrupa otomobil");
    form.append("source_keys", "marktplaats");
    form.append("source_keys", "brave_web");
    form.append("country_codes", "DE");
    form.append("country_codes", "NL");
    form.append("vehicle_type", "car");
    form.append("seat_count", "5");
    form.append("condition", "used_good");

    const result = watchlistSchema.parse(formDataToObject(form));
    expect(result.source_keys).toEqual(["marktplaats", "brave_web"]);
    expect(result.country_codes).toEqual(["DE", "NL"]);
    expect(result.vehicle_type).toBe("car");
    expect(result.seat_count).toBe(5);
    expect(result.condition).toBe("used_good");
  });

  it("validates the production search policy fields", () => {
    const result = watchlistSchema.parse({
      name: "Schengen elektrikli",
      region_preset: "schengen",
      search_mode: "strict",
      freshness_hours: "48",
      sort_by: "price",
      sort_direction: "asc",
      page_size: "50",
    });
    expect(result).toMatchObject({ region_preset: "schengen", search_mode: "strict", freshness_hours: 48, sort_by: "price", sort_direction: "asc", page_size: 50 });
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

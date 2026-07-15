import { describe, expect, it } from "vitest";
import {
  findSourceUrlMismatch,
  ingestPayloadSchema,
  listingUrlMatchesSource,
  MAX_INGEST_BATCH_SIZE,
} from "@/lib/scanner/ingest-validation";

const listing = { listing_url: "https://www.mobile.de/auto-inserat/123" };

describe("scanner ingest payload validation", () => {
  it("accepts a bounded, source-consistent batch", () => {
    const result = ingestPayloadSchema.parse({
      source_key: "mobile_de",
      listings: [{ ...listing, source_key: "mobile_de", price: 12_500 }],
    });
    expect(result.listings[0].price).toBe(12_500);
  });

  it("rejects an arbitrary per-listing source override", () => {
    expect(() => ingestPayloadSchema.parse({
      source_key: "mobile_de",
      listings: [{ ...listing, source_key: "facebook_public" }],
    })).toThrow(/payload source_key/);
  });

  it("rejects empty and oversized batches", () => {
    expect(() => ingestPayloadSchema.parse({ source_key: "mobile_de", listings: [] })).toThrow();
    expect(() => ingestPayloadSchema.parse({
      source_key: "mobile_de",
      listings: Array.from({ length: MAX_INGEST_BATCH_SIZE + 1 }, () => listing),
    })).toThrow();
  });

  it.each([
    "javascript://mobile.de/%0Aalert(1)",
    "data:text/html,vehicle",
    "file://mobile.de/tmp/listing",
    "https://user:password@mobile.de/listing/1",
  ])("rejects unsafe listing URL %s at the shared ingestion boundary", (listingUrl) => {
    expect(() => ingestPayloadSchema.parse({
      source_key: "mobile_de",
      listings: [{ listing_url: listingUrl }],
    })).toThrow(/HTTP\(S\)/);
  });
});

describe("scanner ingest source URL validation", () => {
  it("accepts a source host and its subdomains, but rejects lookalikes", () => {
    const source = { key: "mobile_de", base_url: "https://www.mobile.de" };
    expect(listingUrlMatchesSource("https://suchen.mobile.de/fahrzeuge/details.html?id=1", source)).toBe(true);
    expect(listingUrlMatchesSource("https://mobile.de.evil.example/listing/1", source)).toBe(false);
    expect(listingUrlMatchesSource("https://evil.example/?next=https://mobile.de", source)).toBe(false);
  });

  it("allows the documented Brave aggregator exception", () => {
    const source = { key: "brave_web", base_url: "https://api.search.brave.com" };
    expect(listingUrlMatchesSource("https://www.kleinanzeigen.de/s-anzeige/vehicle/1", source)).toBe(true);
  });

  it("keeps public social sources on their documented hosts", () => {
    expect(listingUrlMatchesSource("https://m.facebook.com/groups/1/posts/2", {
      key: "facebook_public",
      base_url: "https://www.facebook.com/groups",
    })).toBe(true);
    expect(listingUrlMatchesSource("https://telegram.me/example/10", {
      key: "telegram_public",
      base_url: "https://t.me",
    })).toBe(true);
    expect(listingUrlMatchesSource("https://example.com/facebook.com/groups/1", {
      key: "facebook_public",
      base_url: "https://www.facebook.com/groups",
    })).toBe(false);
  });

  it("returns the first mismatched listing index", () => {
    expect(findSourceUrlMismatch([
      listing,
      { listing_url: "https://evil.example/listing/2" },
    ], { key: "mobile_de", base_url: "https://mobile.de" })).toBe(1);
  });
});

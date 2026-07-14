import { describe, expect, it } from "vitest";
import {
  canonicalBrand,
  canonicalCountryCode,
  createCanonicalFingerprint,
  normalizeMarketListing,
} from "@/lib/normalization/normalize-listing";

describe("canonical listing normalization", () => {
  it("normalizes localized aliases and vehicle terminology without changing raw evidence", () => {
    const raw = { description: "VW Golf VII 2.0 TDI Automatik, Händler, Euro6" };
    const result = normalizeMarketListing({
      source_key: "mobile_de",
      source_listing_id: "123",
      listing_url: "https://www.mobile.de/fahrzeuge/details.html?id=123",
      title: "VW Golf VII 2.0 TDI Automatik",
      brand: "VW",
      model: "VW Golf VII",
      seller_country: "Deutschland",
      year: 2019,
      mileage_km: 82_000,
      price: 14_500,
      raw,
    }, new Date("2026-07-13T10:00:00.000Z"));

    expect(result).toMatchObject({
      brand: "Volkswagen",
      model: "Golf VII",
      seller_country_code: "DE",
      fuel_type: "diesel",
      transmission: "automatic",
      seller_type: "dealer",
      emission_class: "Euro 6",
      canonical_schema_version: 1,
      normalized_at: "2026-07-13T10:00:00.000Z",
    });
    expect(result.raw).toBe(raw);
    expect(result.normalization_confidence).toBeGreaterThan(0.6);
    expect(result.canonical_fingerprint).toMatch(/^v1_[a-f0-9]{16}$/);
  });

  it("keeps unknown values unknown and reports data-quality warnings", () => {
    const result = normalizeMarketListing({
      source_key: "brave_web",
      listing_url: "https://dealer.example/listing/1",
      currency: "euro",
    }, new Date("invalid"));

    expect(result.brand).toBeUndefined();
    expect(result.vehicle_type).toBeUndefined();
    expect(result.currency).toBe("EUR");
    expect(result.normalized_at).toBe("1970-01-01T00:00:00.000Z");
    expect(result.normalization_warnings).toEqual(expect.arrayContaining([
      "missing_title",
      "missing_brand",
      "missing_model",
      "missing_vehicle_type",
      "missing_price",
      "missing_country_code",
      "invalid_currency",
    ]));
  });

  it("validates VINs and uses a valid VIN as the strongest duplicate identity", () => {
    const first = createCanonicalFingerprint({
      source_key: "mobile_de",
      listing_url: "https://mobile.de/1",
      vin: "WVWZZZ1JZXW000001",
      price: 10_000,
    });
    const second = createCanonicalFingerprint({
      source_key: "autoscout24",
      listing_url: "https://autoscout24.com/2",
      vin: "wvw zzz 1jz xw 000001",
      price: 25_000,
    });

    expect(first).toBe(second);
  });

  it("normalizes brand and country aliases deterministically", () => {
    expect(canonicalBrand(" Mercedes Benz ")).toBe("Mercedes-Benz");
    expect(canonicalBrand("VW")).toBe("Volkswagen");
    expect(canonicalCountryCode("België")).toBe("BE");
    expect(canonicalCountryCode("ch")).toBe("CH");
  });

  it("rejects invalid VIN and image URLs instead of persisting guesses", () => {
    const result = normalizeMarketListing({
      source_key: "test",
      listing_url: "https://example.com/listing",
      vin: "INVALIDVIN",
      images: [{ url: "javascript:alert(1)" }, { url: "https://cdn.example.com/1.jpg" }],
    });

    expect(result.vin).toBeUndefined();
    expect(result.images).toEqual([{ url: "https://cdn.example.com/1.jpg", position: 1 }]);
    expect(result.normalization_warnings).toEqual(expect.arrayContaining(["invalid_vin", "invalid_image_url"]));
  });
});

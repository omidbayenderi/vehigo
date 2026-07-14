import { describe, expect, it } from "vitest";
import { braveWebAdapter } from "@/lib/scanner/adapters/brave-web";
import { marktplaatsAdapter } from "@/lib/scanner/adapters/marktplaats";
import { createConnectorRegistry, listConnectorManifests, validateConnectorManifest } from "@/lib/scanner/registry";
import type { ScanAdapter } from "@/lib/scanner/adapters/types";
import marktplaatsContract from "@/tests/fixtures/connectors/marktplaats.contract.json";
import braveWebContract from "@/tests/fixtures/connectors/brave-web.contract.json";

describe("connector registry", () => {
  it("publishes versioned capability manifests for every runtime connector", () => {
    const manifests = listConnectorManifests();
    expect(manifests.map((manifest) => manifest.key).sort()).toEqual(["brave_web", "marktplaats"]);
    for (const manifest of manifests) {
      expect(manifest.version).toMatch(/^\d+\.\d+\.\d+$/);
      expect(manifest.acquisitionModes.length).toBeGreaterThan(0);
      expect(manifest.vehicleTypes.length).toBeGreaterThan(0);
      expect(manifest.fieldCoverage).toEqual(expect.arrayContaining(["source_key", "listing_url"]));
    }
  });

  it("rejects duplicate connector keys and manifest mismatches at startup", () => {
    expect(() => createConnectorRegistry([marktplaatsAdapter, marktplaatsAdapter])).toThrow(/Duplicate/);
    const mismatch = {
      ...braveWebAdapter,
      manifest: { ...braveWebAdapter.manifest, key: "different" },
    } as ScanAdapter;
    expect(() => createConnectorRegistry([mismatch])).toThrow(/mismatch/);
  });

  it("matches the checked-in per-source contract fixtures", () => {
    for (const [adapter, contract] of [
      [marktplaatsAdapter, marktplaatsContract],
      [braveWebAdapter, braveWebContract],
    ] as const) {
      expect(adapter.manifest).toMatchObject({
        key: contract.key,
        version: contract.version,
        countries: contract.countries,
        acquisitionModes: contract.acquisitionModes,
      });
      expect(adapter.manifest.fieldCoverage).toEqual(expect.arrayContaining(contract.requiredFields));
      expect(validateConnectorManifest(adapter.manifest)).toEqual([]);
    }
  });

  it("rejects incomplete manifests before the scanner starts", () => {
    expect(validateConnectorManifest({
      ...marktplaatsAdapter.manifest,
      countries: [],
      fieldCoverage: ["title"],
    })).toEqual(expect.arrayContaining(["invalid_countries", "missing_identity_fields"]));
  });
});

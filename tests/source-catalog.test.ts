import { describe, expect, it } from "vitest";
import { marktplaatsAdapter } from "@/lib/scanner/adapters/marktplaats";
import { connectorContractIssues } from "@/lib/services/source-catalog";

describe("source catalog connector contracts", () => {
  it("accepts a catalog row synchronized from the runtime manifest", () => {
    const manifest = marktplaatsAdapter.manifest;
    expect(connectorContractIssues({
      key: manifest.key,
      connector_version: manifest.version,
      acquisition_modes: manifest.acquisitionModes,
      country_codes: manifest.countries,
      vehicle_types: manifest.vehicleTypes,
    }, manifest)).toEqual([]);
  });

  it("reports version and capability drift without hiding either mismatch", () => {
    const manifest = marktplaatsAdapter.manifest;
    expect(connectorContractIssues({
      key: manifest.key,
      connector_version: "0.9.0",
      acquisition_modes: ["saved_search_email"],
      country_codes: ["DE"],
      vehicle_types: ["truck"],
    }, manifest)).toEqual(expect.arrayContaining([
      "version_mismatch",
      "acquisition_modes_mismatch",
      "countries_mismatch",
      "vehicle_types_mismatch",
    ]));
  });
});

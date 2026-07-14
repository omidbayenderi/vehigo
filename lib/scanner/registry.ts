import { braveWebAdapter } from "@/lib/scanner/adapters/brave-web";
import { marktplaatsAdapter } from "@/lib/scanner/adapters/marktplaats";
import type { ScanAdapter } from "@/lib/scanner/adapters/types";

const CONNECTORS = [marktplaatsAdapter, braveWebAdapter] as const satisfies readonly ScanAdapter[];

export const connectorRegistry: ReadonlyMap<string, ScanAdapter> = createConnectorRegistry(CONNECTORS);

export function getConnector(key: string) {
  return connectorRegistry.get(key);
}

export function listConnectorManifests() {
  return [...connectorRegistry.values()].map((connector) => connector.manifest);
}

export function createConnectorRegistry(connectors: readonly ScanAdapter[]) {
  const registry = new Map<string, ScanAdapter>();
  for (const connector of connectors) {
    if (connector.key !== connector.manifest.key) {
      throw new Error(`Connector key mismatch: ${connector.key} != ${connector.manifest.key}`);
    }
    if (registry.has(connector.key)) {
      throw new Error(`Duplicate connector key: ${connector.key}`);
    }
    const issues = validateConnectorManifest(connector.manifest);
    if (issues.length > 0) throw new Error(`Connector ${connector.key} manifest invalid: ${issues.join(", ")}`);
    registry.set(connector.key, connector);
  }
  return registry;
}

export function validateConnectorManifest(manifest: ScanAdapter["manifest"]) {
  const issues: string[] = [];
  if (!/^[a-z0-9_]+$/.test(manifest.key)) issues.push("invalid_key");
  if (!/^\d+\.\d+\.\d+$/.test(manifest.version)) issues.push("invalid_version");
  if (!manifest.displayName.trim()) issues.push("missing_display_name");
  if (manifest.countries.length === 0 || manifest.countries.some((country) => !/^[A-Z]{2}$/.test(country))) issues.push("invalid_countries");
  if (manifest.acquisitionModes.length === 0) issues.push("missing_acquisition_modes");
  if (manifest.vehicleTypes.length === 0) issues.push("missing_vehicle_types");
  if (!manifest.fieldCoverage.includes("source_key") || !manifest.fieldCoverage.includes("listing_url")) issues.push("missing_identity_fields");
  if (hasDuplicates(manifest.countries) || hasDuplicates(manifest.acquisitionModes) || hasDuplicates(manifest.vehicleTypes) || hasDuplicates(manifest.fieldCoverage)) issues.push("duplicate_manifest_values");
  return issues;
}

function hasDuplicates(values: readonly string[]) {
  return new Set(values).size !== values.length;
}

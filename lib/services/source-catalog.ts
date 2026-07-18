import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/lib/supabase/types";
import type { ConnectorManifest } from "@/lib/scanner/adapters/types";
import { getConnector, listConnectorManifests } from "@/lib/scanner/registry";

type Client = SupabaseClient<Database>;
type MarketSource = Database["public"]["Tables"]["market_sources"]["Row"];
type ContractSource = Pick<MarketSource, "key" | "connector_version" | "acquisition_modes" | "country_codes" | "vehicle_types" | "persistence_policy">;

export type ConnectorCatalogState = "operational" | "catalog_only" | "runtime_only" | "contract_mismatch";
export type ConnectorCatalogRow = {
  source: MarketSource | null;
  manifest: ConnectorManifest | null;
  state: ConnectorCatalogState;
  issues: string[];
};

export function connectorContractIssues(source: ContractSource, manifest: ConnectorManifest) {
  const issues: string[] = [];
  if (source.key !== manifest.key) issues.push("key_mismatch");
  if (source.connector_version && source.connector_version !== manifest.version) issues.push("version_mismatch");
  if (source.acquisition_modes && !sameSet(source.acquisition_modes, manifest.acquisitionModes)) issues.push("acquisition_modes_mismatch");
  if (source.country_codes && !sameSet(source.country_codes, manifest.countries)) issues.push("countries_mismatch");
  if (source.vehicle_types && !sameSet(source.vehicle_types, manifest.vehicleTypes)) issues.push("vehicle_types_mismatch");
  if (source.persistence_policy && source.persistence_policy !== manifest.persistencePolicy) issues.push("persistence_policy_mismatch");
  return issues;
}

export async function syncRuntimeConnectorCatalog(supabase: Client) {
  const checkedAt = new Date().toISOString();
  const results: Array<{ key: string; ok: boolean; error: string | null }> = [];

  for (const manifest of listConnectorManifests()) {
    const { data, error } = await supabase
      .from("market_sources")
      .update({
        country_codes: manifest.countries,
        vehicle_types: manifest.vehicleTypes,
        acquisition_modes: manifest.acquisitionModes,
        connector_version: manifest.version,
        connector_capabilities: {
          direct_search: manifest.supportsDirectSearch,
          incremental_sync: manifest.supportsIncrementalSync,
          field_coverage: manifest.fieldCoverage,
          persistence_provider_key: manifest.persistenceProviderKey,
        } as Json,
        persistence_policy: manifest.persistencePolicy,
        catalog_status: "available",
        last_contract_check_at: checkedAt,
      })
      .eq("key", manifest.key)
      .select("key")
      .maybeSingle();
    results.push({
      key: manifest.key,
      ok: Boolean(data) && !error,
      error: error?.message ?? (data ? null : "missing_catalog_record"),
    });
  }

  return results;
}

export async function getConnectorCatalogSnapshot(supabase: Client) {
  const { data: sources, error } = await supabase.from("market_sources").select("*").order("name");
  if (error) throw new Error(error.message);

  const sourceByKey = new Map((sources ?? []).map((source) => [source.key, source]));
  const runtimeKeys = new Set(listConnectorManifests().map((manifest) => manifest.key));
  const rows: ConnectorCatalogRow[] = (sources ?? []).map((source): ConnectorCatalogRow => {
    const connector = getConnector(source.key);
    const issues = connector ? connectorContractIssues(source, connector.manifest) : [];
    const state: ConnectorCatalogState = connector
      ? issues.length > 0 ? "contract_mismatch" : "operational"
      : "catalog_only";
    return { source, manifest: connector?.manifest ?? null, state, issues };
  });

  for (const manifest of listConnectorManifests()) {
    if (sourceByKey.has(manifest.key)) continue;
    rows.push({ source: null, manifest, state: "runtime_only", issues: ["missing_catalog_record"] });
  }

  return {
    rows,
    summary: {
      catalogSources: sourceByKey.size,
      runtimeConnectors: runtimeKeys.size,
      operational: rows.filter((row) => row.state === "operational").length,
      mismatched: rows.filter((row) => row.state === "contract_mismatch" || row.state === "runtime_only").length,
    },
  };
}

function sameSet(left: readonly string[], right: readonly string[]) {
  return left.length === right.length && left.every((value) => right.includes(value));
}

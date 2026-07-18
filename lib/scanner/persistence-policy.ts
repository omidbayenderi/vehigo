import type { SupabaseClient } from "@supabase/supabase-js";
import type { ScanAdapter } from "@/lib/scanner/adapters/types";
import type { Database } from "@/lib/supabase/types";

type Client = SupabaseClient<Database>;

export const REQUIRED_LISTING_DATA_CLASSES = [
  "result_url",
  "result_title",
  "result_snippet",
  "seller_name",
  "derived_listing",
] as const;

export type ConnectorProcessingDecision = {
  mode: "persistent" | "transient";
  reason: "policy_permitted" | "transient_only" | "persistence_not_requested" | "evidence_verified" | "evidence_missing";
};

export async function resolveConnectorProcessingMode(
  supabase: Client,
  adapter: ScanAdapter,
  now = new Date(),
): Promise<ConnectorProcessingDecision> {
  const policy = adapter.manifest.persistencePolicy;
  if (adapter.processingMode === "transient" || policy === "transient_only") {
    return { mode: "transient", reason: "transient_only" };
  }
  if (policy === "permitted") return { mode: "persistent", reason: "policy_permitted" };
  if (!persistenceRequested(adapter.key)) {
    return { mode: "transient", reason: "persistence_not_requested" };
  }

  const iso = now.toISOString();
  const { data, error } = await supabase
    .from("provider_storage_rights_evidence")
    .select("permitted_data_classes,permitted_territories")
    .eq("provider_key", adapter.manifest.persistenceProviderKey)
    .is("revoked_at", null)
    .lte("effective_at", iso)
    .gt("expires_at", iso);
  if (error) return { mode: "transient", reason: "evidence_missing" };

  const verified = (data ?? []).some((evidence) =>
    REQUIRED_LISTING_DATA_CLASSES.every((item) => evidence.permitted_data_classes.includes(item))
    && territoriesCover(evidence.permitted_territories, adapter.manifest.countries),
  );
  return verified
    ? { mode: "persistent", reason: "evidence_verified" }
    : { mode: "transient", reason: "evidence_missing" };
}

function persistenceRequested(sourceKey: string) {
  if (sourceKey === "brave_web") {
    return process.env.BRAVE_SEARCH_MODE === "persistent_search"
      && process.env.BRAVE_SEARCH_STORAGE_RIGHTS_CONFIRMED === "true";
  }
  if (sourceKey.startsWith("apify_")) return process.env.APIFY_PERSIST_RESULTS === "true";
  return process.env.CONNECTOR_PERSIST_RESULTS === "true";
}

function territoriesCover(permitted: string[], required: string[]) {
  const normalized = new Set(permitted.map((territory) => territory.toUpperCase()));
  if (normalized.has("*") || normalized.has("EUROPE")) return true;
  return required.every((territory) => territory === "EU"
    ? normalized.has("EU")
    : normalized.has(territory) || normalized.has("EU"));
}

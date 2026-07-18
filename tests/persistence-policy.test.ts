import { afterEach, describe, expect, it, vi } from "vitest";
import type { ScanAdapter } from "@/lib/scanner/adapters/types";
import { REQUIRED_LISTING_DATA_CLASSES, resolveConnectorProcessingMode } from "@/lib/scanner/persistence-policy";

function adapter(key = "apify_mobile_de"): ScanAdapter {
  return {
    key,
    manifest: {
      key,
      version: "1.0.0",
      displayName: key,
      countries: ["DE"],
      acquisitionModes: ["authorized_automation"],
      vehicleTypes: ["car"],
      fieldCoverage: ["source_key", "listing_url"],
      supportsDirectSearch: true,
      supportsIncrementalSync: false,
      persistencePolicy: "evidence_required",
      persistenceProviderKey: key,
    },
    fetchListings: vi.fn(),
  };
}

function client(rows: unknown[]) {
  const chain: Record<string, unknown> = {};
  for (const method of ["select", "eq", "is", "lte", "gt"]) chain[method] = vi.fn(() => chain);
  chain.then = (resolve: (value: unknown) => unknown) => Promise.resolve({ data: rows, error: null }).then(resolve);
  return { from: vi.fn(() => chain) };
}

afterEach(() => {
  delete process.env.APIFY_PERSIST_RESULTS;
  delete process.env.BRAVE_SEARCH_MODE;
  delete process.env.BRAVE_SEARCH_STORAGE_RIGHTS_CONFIRMED;
});

describe("connector persistence policy", () => {
  it("defaults evidence-gated connectors to transient processing", async () => {
    const supabase = client([]);
    await expect(resolveConnectorProcessingMode(supabase as never, adapter())).resolves.toEqual({
      mode: "transient",
      reason: "persistence_not_requested",
    });
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it("allows persistence only when operator intent and active evidence agree", async () => {
    process.env.APIFY_PERSIST_RESULTS = "true";
    const supabase = client([{
      permitted_data_classes: [...REQUIRED_LISTING_DATA_CLASSES],
      permitted_territories: ["EU"],
    }]);
    await expect(resolveConnectorProcessingMode(supabase as never, adapter())).resolves.toEqual({
      mode: "persistent",
      reason: "evidence_verified",
    });
  });

  it("fails closed when evidence does not cover the stored data", async () => {
    process.env.APIFY_PERSIST_RESULTS = "true";
    const supabase = client([{ permitted_data_classes: ["result_url"], permitted_territories: ["DE"] }]);
    await expect(resolveConnectorProcessingMode(supabase as never, adapter())).resolves.toEqual({
      mode: "transient",
      reason: "evidence_missing",
    });
  });
});

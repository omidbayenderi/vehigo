import { afterEach, describe, expect, it, vi } from "vitest";
import { vertexSearchProvider } from "@/lib/scanner/search-providers/providers";
import { checkFederatedSearchProviders } from "@/lib/scanner/search-providers/health";
import type { FederatedSearchProvider, FederatedSearchProviderKey } from "@/lib/scanner/search-providers/types";

afterEach(() => vi.unstubAllEnvs());

describe("federated search provider configuration", () => {
  it("does not activate Vertex for an OAuth token or malformed service-account value", () => {
    vi.stubEnv("GOOGLE_CLOUD_PROJECT_ID", "vehigo-test");
    vi.stubEnv("GOOGLE_VERTEX_SERVICE_ACCOUNT_JSON", "AQ.temporary-access-token");

    expect(vertexSearchProvider.configured()).toBe(false);
  });

  it("activates Vertex only for a service account containing email and private key", () => {
    vi.stubEnv("GOOGLE_CLOUD_PROJECT_ID", "vehigo-test");
    vi.stubEnv("GOOGLE_VERTEX_SERVICE_ACCOUNT_JSON", JSON.stringify({
      client_email: "vehigo@example.iam.gserviceaccount.com",
      private_key: "-----BEGIN PRIVATE KEY-----\ntest\n-----END PRIVATE KEY-----\n",
    }));

    expect(vertexSearchProvider.configured()).toBe(true);
  });

  it("returns only sanitized provider health evidence", async () => {
    const providers = Object.fromEntries(
      (["brave", "tavily", "exa", "vertex"] as FederatedSearchProviderKey[]).map((key) => [key, {
        key,
        configured: () => true,
        search: vi.fn().mockResolvedValue({
          hits: [{ url: `https://${key}.example/listing`, title: "Vehicle" }],
          moreResultsAvailable: false,
        }),
      } satisfies FederatedSearchProvider]),
    );

    const results = await checkFederatedSearchProviders({ providers });

    expect(results).toHaveLength(4);
    expect(results.every((result) => result.ok && result.hitCount === 1)).toBe(true);
    expect(results.map((result) => result.hosts?.[0])).toEqual([
      "brave.example",
      "tavily.example",
      "exa.example",
      "vertex.example",
    ]);
  });
});

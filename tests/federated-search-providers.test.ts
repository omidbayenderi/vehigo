import { afterEach, describe, expect, it, vi } from "vitest";
import { vertexSearchProvider } from "@/lib/scanner/search-providers/providers";

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
});

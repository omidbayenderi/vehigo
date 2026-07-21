import { FEDERATED_SEARCH_PROVIDERS } from "@/lib/scanner/search-providers/providers";
import type { FederatedSearchProviderKey } from "@/lib/scanner/search-providers/types";

if (!process.argv.includes("--live")) {
  throw new Error("Canlı sağlayıcı çağrıları için --live kullanın.");
}

const query = process.env.FEDERATED_SEARCH_ACCEPTANCE_QUERY
  ?? "Renault Clio 2021 mobile.de gebraucht kaufen";
const providerKeys = ["brave", "tavily", "exa", "vertex"] as const;

void main();

async function main() {
  const results = await Promise.all(providerKeys.map(runProvider));
  console.log(JSON.stringify(results, null, 2));

  if (results.some((result) => !result.ok)) process.exitCode = 1;
}

async function runProvider(providerKey: FederatedSearchProviderKey) {
  const provider = FEDERATED_SEARCH_PROVIDERS[providerKey];
  if (!provider.configured()) {
    return { provider: providerKey, ok: false, hitCount: 0, error: "not_configured" };
  }

  try {
    const response = await provider.search({ query, offset: 0, maxResults: 5 });
    const hosts = [...new Set(response.hits.flatMap((hit) => {
      try {
        return [new URL(hit.url).hostname];
      } catch {
        return [];
      }
    }))].slice(0, 3);

    return {
      provider: providerKey,
      ok: response.hits.length > 0,
      hitCount: response.hits.length,
      hosts,
      requestIdPresent: Boolean(response.requestId),
      reportedCostUsd: response.reportedCostUsd,
      error: response.hits.length > 0 ? undefined : "zero_results",
    };
  } catch (error) {
    return {
      provider: providerKey,
      ok: false,
      hitCount: 0,
      error: error instanceof Error ? error.message : "unknown_error",
    };
  }
}

import { FEDERATED_SEARCH_PROVIDERS } from "./providers";
import type {
  FederatedSearchProvider,
  FederatedSearchProviderKey,
} from "./types";

const PROVIDER_KEYS = ["brave", "tavily", "exa", "vertex"] as const;
const DEFAULT_QUERY = "Renault Clio 2021 mobile.de gebraucht kaufen";

export type FederatedProviderHealthResult = {
  provider: FederatedSearchProviderKey;
  ok: boolean;
  hitCount: number;
  hosts?: string[];
  requestIdPresent?: boolean;
  reportedCostUsd?: number;
  error?: string;
};

export async function checkFederatedSearchProviders(input: {
  query?: string;
  providers?: Partial<Record<FederatedSearchProviderKey, FederatedSearchProvider>>;
} = {}): Promise<FederatedProviderHealthResult[]> {
  const providers = { ...FEDERATED_SEARCH_PROVIDERS, ...input.providers };
  return Promise.all(PROVIDER_KEYS.map((key) => checkProvider(key, providers[key], input.query ?? DEFAULT_QUERY)));
}

async function checkProvider(
  providerKey: FederatedSearchProviderKey,
  provider: FederatedSearchProvider,
  query: string,
): Promise<FederatedProviderHealthResult> {
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

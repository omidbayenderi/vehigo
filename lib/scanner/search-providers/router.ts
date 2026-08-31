import type { ScannerWatchlist } from "@/lib/scanner/adapters/types";
import type { FederatedSearchCache } from "./cache";
import { FEDERATED_SEARCH_PROVIDERS } from "./providers";
import type {
  FederatedSearchHit,
  FederatedSearchProvider,
  FederatedSearchProviderKey,
} from "./types";

export type FederatedRouteResult = {
  hits: FederatedSearchHit[];
  providersAttempted: FederatedSearchProviderKey[];
  providerRequestCount: number;
  cacheHit: boolean;
  moreResultsAvailable: boolean;
};

export async function routedVehicleSearch(input: {
  query: string;
  watchlist: ScannerWatchlist | null;
  offset: number;
  maxResults: number;
  scoreHits: (hits: FederatedSearchHit[]) => number;
  maxProviderRequests?: number;
  onProviderRequest?: (provider: FederatedSearchProviderKey) => void;
  cache?: FederatedSearchCache;
  providers?: Partial<Record<FederatedSearchProviderKey, FederatedSearchProvider>>;
}): Promise<FederatedRouteResult> {
  const intent = classifySearchIntent(input.watchlist);
  const providers = { ...FEDERATED_SEARCH_PROVIDERS, ...input.providers };
  const route = routeForIntent(intent)
    .map((group) => group.map((key) => providers[key]).find((provider) => provider?.configured()))
    .filter((provider): provider is FederatedSearchProvider => Boolean(provider));
  if (route.length === 0) throw new Error("federated_search: yapılandırılmış sağlayıcı yok");

  const providersAttempted: FederatedSearchProviderKey[] = [];
  const collected: FederatedSearchHit[] = [];
  let providerRequestCount = 0;
  let cacheHit = false;
  let moreResultsAvailable = false;
  let firstFailure: unknown;
  let providerCompleted = false;

  const maxProviderRequests = Math.max(1, Math.min(2, input.maxProviderRequests ?? 2));
  for (const provider of route) {
    providersAttempted.push(provider.key);
    const cached = await input.cache?.read(provider.key, input.query);
    if (cached) {
      cacheHit = true;
      collected.push(...cached);
      if (input.scoreHits(dedupeHits(collected)) >= minimumAcceptableResults()) break;
      continue;
    }

    try {
      if (providerRequestCount >= maxProviderRequests) break;
      providerRequestCount += 1;
      input.onProviderRequest?.(provider.key);
      const response = await provider.search({ query: input.query, offset: input.offset, maxResults: input.maxResults });
      providerCompleted = true;
      collected.push(...response.hits);
      moreResultsAvailable ||= response.moreResultsAvailable;
      await input.cache?.write(provider.key, input.query, response.hits);
      if (input.scoreHits(dedupeHits(collected)) >= minimumAcceptableResults()) break;
    } catch (error) {
      firstFailure ??= error;
    }
  }

  const hits = dedupeHits(collected);
  await input.cache?.record({
    query: input.query,
    intent,
    providersAttempted,
    providerRequestCount,
    resultCount: hits.length,
    cacheHit,
  });
  // A fallback provider that completed successfully owns the outcome even when
  // the current query genuinely has no hits. Re-throw only when every attempted
  // live provider failed; otherwise a paid-provider outage incorrectly marks the
  // whole Europe Web Scout run as failed.
  if (hits.length === 0 && firstFailure && !providerCompleted) throw firstFailure;
  return { hits, providersAttempted, providerRequestCount, cacheHit, moreResultsAvailable };
}

export function classifySearchIntent(watchlist: ScannerWatchlist | null): "specific" | "market" {
  if (!watchlist?.brand || !watchlist.model) return "market";
  const specificity = [
    watchlist.min_year,
    watchlist.max_year,
    watchlist.min_price,
    watchlist.max_price,
    watchlist.max_mileage_km,
    watchlist.seller_type,
    watchlist.exterior_color,
    watchlist.fuel_type,
    watchlist.transmission,
  ].filter((value) => value !== null && value !== undefined).length;
  return specificity >= 2 ? "specific" : "market";
}

function routeForIntent(intent: "specific" | "market"): FederatedSearchProviderKey[][] {
  return intent === "specific"
    ? [["exa", "tavily"], ["vertex", "brave"]]
    : [["vertex"], ["brave", "tavily", "exa"]];
}

function minimumAcceptableResults() {
  const parsed = Number.parseInt(process.env.FEDERATED_SEARCH_MIN_RESULTS ?? "3", 10);
  return Number.isFinite(parsed) ? Math.max(1, Math.min(20, parsed)) : 3;
}

function dedupeHits(hits: FederatedSearchHit[]) {
  const seen = new Set<string>();
  return hits.filter((hit) => {
    const key = canonicalUrl(hit.url);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function canonicalUrl(value: string) {
  try {
    const url = new URL(value);
    url.hash = "";
    for (const key of [...url.searchParams.keys()]) {
      if (/^(utm_.+|fbclid|gclid|msclkid|ref|referrer|source|campaign)$/i.test(key)) url.searchParams.delete(key);
    }
    url.searchParams.sort();
    return url.toString();
  } catch {
    return null;
  }
}

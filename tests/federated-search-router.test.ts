import { describe, expect, it, vi } from "vitest";
import type { ScannerWatchlist } from "@/lib/scanner/adapters/types";
import { classifySearchIntent, routedVehicleSearch } from "@/lib/scanner/search-providers/router";
import type { FederatedSearchHit, FederatedSearchProvider, FederatedSearchProviderKey } from "@/lib/scanner/search-providers/types";

const exactWatchlist = {
  brand: "Renault",
  model: "Clio",
  min_year: 2021,
  max_price: 18_000,
} as ScannerWatchlist;

function provider(key: FederatedSearchProviderKey, hits: FederatedSearchHit[], configured = true): FederatedSearchProvider {
  return {
    key,
    configured: () => configured,
    search: vi.fn().mockResolvedValue({ hits, moreResultsAvailable: false }),
  };
}

function hits(prefix: string, count: number) {
  return Array.from({ length: count }, (_, index) => ({
    url: `https://example.com/${prefix}/${index}`,
    title: `${prefix} ${index}`,
  }));
}

describe("cost-aware federated search router", () => {
  it("classifies brand/model plus two hard filters as a specific search", () => {
    expect(classifySearchIntent(exactWatchlist)).toBe("specific");
    expect(classifySearchIntent({ ...exactWatchlist, min_year: null, max_price: null })).toBe("market");
  });

  it("stops after Exa when a specific search has enough valid results", async () => {
    const exa = provider("exa", hits("exa", 3));
    const brave = provider("brave", hits("brave", 3));
    const result = await routedVehicleSearch({
      query: "red 2021 Renault Clio private seller",
      watchlist: exactWatchlist,
      offset: 0,
      maxResults: 20,
      scoreHits: (items) => items.length,
      providers: { exa, brave, tavily: provider("tavily", [], false), vertex: provider("vertex", [], false) },
    });
    expect(result.providersAttempted).toEqual(["exa"]);
    expect(result.providerRequestCount).toBe(1);
    expect(brave.search).not.toHaveBeenCalled();
  });

  it("uses one fallback stage and deterministically deduplicates URLs", async () => {
    const exa = provider("exa", [{ url: "https://example.com/listing?utm_source=exa" }]);
    const brave = provider("brave", [
      { url: "https://example.com/listing" },
      { url: "https://example.com/second" },
      { url: "https://example.com/third" },
    ]);
    const result = await routedVehicleSearch({
      query: "red 2021 Renault Clio private seller",
      watchlist: exactWatchlist,
      offset: 0,
      maxResults: 20,
      scoreHits: (items) => items.length,
      providers: { exa, brave, tavily: provider("tavily", [], false), vertex: provider("vertex", [], false) },
    });
    expect(result.providersAttempted).toEqual(["exa", "brave"]);
    expect(result.providerRequestCount).toBe(2);
    expect(result.hits).toHaveLength(3);
  });

  it("routes broad market discovery to Vertex before Brave", async () => {
    const vertex = provider("vertex", hits("vertex", 3));
    const brave = provider("brave", hits("brave", 3));
    const result = await routedVehicleSearch({
      query: "used cars Europe",
      watchlist: null,
      offset: 0,
      maxResults: 20,
      scoreHits: (items) => items.length,
      providers: { vertex, brave, exa: provider("exa", [], false), tavily: provider("tavily", [], false) },
    });
    expect(result.providersAttempted).toEqual(["vertex"]);
    expect(brave.search).not.toHaveBeenCalled();
  });

  it("falls back from an insufficient broad Vertex search to Brave", async () => {
    const vertex = provider("vertex", hits("vertex", 1));
    const brave = provider("brave", hits("brave", 3));
    const result = await routedVehicleSearch({
      query: "used cars Europe",
      watchlist: null,
      offset: 0,
      maxResults: 20,
      scoreHits: (items) => items.length,
      providers: { vertex, brave, exa: provider("exa", [], false), tavily: provider("tavily", [], false) },
    });
    expect(result.providersAttempted).toEqual(["vertex", "brave"]);
    expect(result.providerRequestCount).toBe(2);
  });

  it("counts a cache hit without making a provider request", async () => {
    const brave = provider("brave", hits("brave", 3));
    const result = await routedVehicleSearch({
      query: "used cars Europe",
      watchlist: null,
      offset: 0,
      maxResults: 20,
      scoreHits: (items) => items.length,
      providers: { brave, vertex: provider("vertex", [], false), exa: provider("exa", [], false), tavily: provider("tavily", [], false) },
      cache: {
        read: vi.fn().mockResolvedValue(hits("cache", 3)),
        write: vi.fn(),
        record: vi.fn(),
      },
    });
    expect(result.cacheHit).toBe(true);
    expect(result.providerRequestCount).toBe(0);
    expect(brave.search).not.toHaveBeenCalled();
  });
});

export type FederatedSearchProviderKey = "exa" | "tavily" | "vertex" | "brave";

export type FederatedSearchHit = {
  url: string;
  title?: string;
  description?: string;
  age?: string;
  profileName?: string;
};

export type FederatedSearchRequest = {
  query: string;
  offset: number;
  maxResults: number;
};

export type FederatedSearchResponse = {
  hits: FederatedSearchHit[];
  moreResultsAvailable: boolean;
  requestId?: string;
  reportedCostUsd?: number;
};

export type FederatedSearchProvider = {
  key: FederatedSearchProviderKey;
  configured: () => boolean;
  search: (request: FederatedSearchRequest) => Promise<FederatedSearchResponse>;
};

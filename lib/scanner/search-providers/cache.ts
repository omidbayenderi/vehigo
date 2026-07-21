import { createHmac } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/lib/supabase/types";
import type { FederatedSearchHit, FederatedSearchProviderKey } from "./types";

type Client = SupabaseClient<Database>;

export type FederatedSearchCache = {
  read: (provider: FederatedSearchProviderKey, query: string) => Promise<FederatedSearchHit[] | null>;
  write: (provider: FederatedSearchProviderKey, query: string, hits: FederatedSearchHit[]) => Promise<void>;
  record: (input: {
    query: string;
    intent: "specific" | "market";
    providersAttempted: FederatedSearchProviderKey[];
    providerRequestCount: number;
    resultCount: number;
    cacheHit: boolean;
  }) => Promise<void>;
};

export function createFederatedSearchCache(supabase: Client): FederatedSearchCache | undefined {
  const secret = process.env.SEARCH_CACHE_HMAC_SECRET ?? process.env.SCANNER_INGEST_SECRET;
  if (!secret || secret.length < 32) return undefined;

  return {
    async read(provider, query) {
      if (!providerStorageConfirmed(provider)) return null;
      const { data, error } = await supabase
        .from("federated_search_result_cache")
        .select("id,result_payload")
        .eq("provider", provider)
        .eq("query_hash", queryHash(secret, query))
        .gt("expires_at", new Date().toISOString())
        .maybeSingle();
      if (error || !data) return null;
      const hits = parseCachedHits(data.result_payload);
      if (!hits) return null;
      await supabase.rpc("touch_federated_search_cache", { p_cache_id: data.id });
      return hits;
    },
    async write(provider, query, hits) {
      if (!providerStorageConfirmed(provider) || hits.length === 0) return;
      const ttlHours = boundedInt(process.env.FEDERATED_SEARCH_CACHE_TTL_HOURS, 24, 1, 24);
      const now = new Date();
      const payload = sanitizeHits(hits);
      await supabase.from("federated_search_result_cache").upsert({
        provider,
        query_hash: queryHash(secret, query),
        result_payload: payload as unknown as Json,
        result_count: payload.length,
        storage_basis: "operator_confirmed",
        expires_at: new Date(now.getTime() + ttlHours * 3_600_000).toISOString(),
        created_at: now.toISOString(),
        updated_at: now.toISOString(),
      }, { onConflict: "provider,query_hash" });
    },
    async record(input) {
      const today = new Date().toISOString().slice(0, 10);
      await supabase.rpc("record_federated_search_receipt", {
        p_query_hash: queryHash(secret, input.query),
        p_search_day: today,
        p_intent: input.intent,
        p_providers_attempted: input.providersAttempted,
        p_provider_request_count: input.providerRequestCount,
        p_result_count: input.resultCount,
        p_cache_hit: input.cacheHit,
      });
    },
  };
}

function providerStorageConfirmed(provider: FederatedSearchProviderKey) {
  const envByProvider: Record<FederatedSearchProviderKey, string> = {
    brave: "BRAVE_SEARCH_CACHE_STORAGE_RIGHTS_CONFIRMED",
    tavily: "TAVILY_CACHE_STORAGE_RIGHTS_CONFIRMED",
    exa: "EXA_CACHE_STORAGE_RIGHTS_CONFIRMED",
    vertex: "GOOGLE_VERTEX_CACHE_STORAGE_RIGHTS_CONFIRMED",
  };
  return process.env[envByProvider[provider]] === "true";
}

function queryHash(secret: string, query: string) {
  return createHmac("sha256", secret).update("vehigo:federated-search:v1\0").update(query.trim().replace(/\s+/g, " ")).digest("hex");
}

function sanitizeHits(hits: FederatedSearchHit[]) {
  return hits.slice(0, 20).map((hit) => ({
    url: hit.url.slice(0, 2000),
    title: hit.title?.slice(0, 500),
    description: hit.description?.slice(0, 1000),
    age: hit.age?.slice(0, 100),
    profileName: hit.profileName?.slice(0, 300),
  }));
}

function parseCachedHits(value: Json): FederatedSearchHit[] | null {
  if (!Array.isArray(value)) return null;
  const hits = value.flatMap((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return [];
    const record = item as Record<string, Json | undefined>;
    if (typeof record.url !== "string") return [];
    return [{
      url: record.url,
      title: typeof record.title === "string" ? record.title : undefined,
      description: typeof record.description === "string" ? record.description : undefined,
      age: typeof record.age === "string" ? record.age : undefined,
      profileName: typeof record.profileName === "string" ? record.profileName : undefined,
    }];
  });
  return hits.length > 0 ? hits : null;
}

function boundedInt(value: string | undefined, fallback: number, min: number, max: number) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) ? Math.max(min, Math.min(max, parsed)) : fallback;
}

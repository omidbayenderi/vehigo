import { createSign } from "node:crypto";
import type {
  FederatedSearchHit,
  FederatedSearchProvider,
} from "./types";

const REQUEST_TIMEOUT_MS = 15_000;
const BRAVE_ENDPOINT = "https://api.search.brave.com/res/v1/web/search";
const TAVILY_ENDPOINT = "https://api.tavily.com/search";
const EXA_ENDPOINT = "https://api.exa.ai/search";

export const braveSearchProvider: FederatedSearchProvider = {
  key: "brave",
  configured: () => Boolean(process.env.BRAVE_SEARCH_API_KEY),
  async search(request) {
    const token = requiredEnv("BRAVE_SEARCH_API_KEY");
    const url = new URL(BRAVE_ENDPOINT);
    url.searchParams.set("q", request.query);
    url.searchParams.set("count", String(Math.min(20, request.maxResults)));
    url.searchParams.set("safesearch", "off");
    url.searchParams.set("extra_snippets", "true");
    url.searchParams.set("offset", String(Math.max(0, Math.min(request.offset, 9))));
    const response = await timedFetch(url, {
      headers: { Accept: "application/json", "X-Subscription-Token": token },
    });
    const payload = await responseJson<BravePayload>(response, "brave");
    return {
      hits: (payload.web?.results ?? []).flatMap((item) => item.url ? [{
        url: item.url,
        title: item.title,
        description: [item.description, ...(item.extra_snippets ?? [])].filter(Boolean).join(" "),
        age: item.age,
        profileName: item.profile?.name,
      }] : []),
      moreResultsAvailable: payload.query?.more_results_available === true,
    };
  },
};

export const tavilySearchProvider: FederatedSearchProvider = {
  key: "tavily",
  configured: () => Boolean(process.env.TAVILY_API_KEY),
  async search(request) {
    const response = await timedFetch(TAVILY_ENDPOINT, {
      method: "POST",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${requiredEnv("TAVILY_API_KEY")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query: removeSiteOperators(request.query),
        search_depth: "basic",
        topic: "general",
        include_answer: false,
        include_raw_content: false,
        include_images: false,
        max_results: Math.min(20, request.maxResults),
        ...(siteDomains(request.query).length > 0 ? { include_domains: siteDomains(request.query) } : {}),
      }),
    });
    const payload = await responseJson<TavilyPayload>(response, "tavily");
    return {
      hits: (payload.results ?? []).flatMap((item) => item.url ? [{
        url: item.url,
        title: item.title,
        description: item.content,
      }] : []),
      moreResultsAvailable: false,
      requestId: payload.request_id,
    };
  },
};

export const exaSearchProvider: FederatedSearchProvider = {
  key: "exa",
  configured: () => Boolean(process.env.EXA_API_KEY),
  async search(request) {
    const response = await timedFetch(EXA_ENDPOINT, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "x-api-key": requiredEnv("EXA_API_KEY"),
      },
      body: JSON.stringify({
        query: removeSiteOperators(request.query),
        type: "fast",
        numResults: Math.min(20, request.maxResults),
        moderation: true,
        ...(siteDomains(request.query).length > 0 ? { includeDomains: siteDomains(request.query) } : {}),
      }),
    });
    const payload = await responseJson<ExaPayload>(response, "exa");
    return {
      hits: (payload.results ?? []).flatMap((item) => item.url ? [{
        url: item.url,
        title: item.title,
        description: item.text ?? item.highlights?.join(" "),
      }] : []),
      moreResultsAvailable: false,
      requestId: payload.requestId,
      reportedCostUsd: payload.costDollars?.total,
    };
  },
};

export const vertexSearchProvider: FederatedSearchProvider = {
  key: "vertex",
  configured: () => Boolean(process.env.GOOGLE_CLOUD_PROJECT_ID && readVertexServiceAccount()),
  async search(request) {
    const projectId = requiredEnv("GOOGLE_CLOUD_PROJECT_ID");
    const location = process.env.GOOGLE_CLOUD_LOCATION ?? "global";
    const model = process.env.GOOGLE_VERTEX_MODEL ?? "gemini-2.5-flash-lite";
    const host = location === "global" ? "aiplatform.googleapis.com" : `${location}-aiplatform.googleapis.com`;
    const endpoint = `https://${host}/v1/projects/${encodeURIComponent(projectId)}/locations/${encodeURIComponent(location)}/publishers/google/models/${encodeURIComponent(model)}:generateContent`;
    const response = await timedFetch(endpoint, {
      method: "POST",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${await vertexAccessToken()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: `Find current individual vehicle listing pages matching this search. Prefer exact listing detail URLs, not category pages. Search: ${request.query}` }] }],
        tools: [{ googleSearch: {} }],
        generationConfig: { temperature: 0, maxOutputTokens: 384 },
      }),
    });
    const payload = await responseJson<VertexPayload>(response, "vertex");
    return {
      hits: vertexHits(payload).slice(0, request.maxResults),
      moreResultsAvailable: false,
      requestId: response.headers.get("x-request-id") ?? undefined,
    };
  },
};

export const FEDERATED_SEARCH_PROVIDERS = {
  exa: exaSearchProvider,
  tavily: tavilySearchProvider,
  vertex: vertexSearchProvider,
  brave: braveSearchProvider,
} as const;

function siteDomains(query: string) {
  return [...new Set([...query.matchAll(/site:([a-z0-9.-]+)/gi)].map((match) => match[1].toLowerCase()))].slice(0, 300);
}

function removeSiteOperators(query: string) {
  return query
    .replace(/\(?\s*(?:OR\s+)?site:[a-z0-9.-]+\s*\)?/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function timedFetch(input: string | URL, init: RequestInit) {
  return fetch(input, { ...init, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
}

async function responseJson<T>(response: Response, provider: string) {
  const payload = await response.json().catch(() => null) as T | null;
  if (!response.ok || !payload) {
    const detail = providerErrorDetail(payload);
    throw new Error(`${provider}_web: HTTP ${response.status}${detail ? ` (${detail})` : ""}`);
  }
  return payload;
}

function providerErrorDetail(payload: unknown) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null;
  const record = payload as Record<string, unknown>;
  const error = record.error && typeof record.error === "object" && !Array.isArray(record.error)
    ? record.error as Record<string, unknown>
    : record;
  const parts = [error.status, error.code, error.message, record.detail]
    .filter((value): value is string | number => typeof value === "string" || typeof value === "number")
    .map((value) => String(value).replace(/\s+/g, " ").trim())
    .filter(Boolean);
  return parts.length > 0 ? parts.join(": ").slice(0, 300) : null;
}

function requiredEnv(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} tanımlı değil`);
  return value;
}

let cachedVertexToken: { value: string; expiresAt: number } | null = null;

async function vertexAccessToken() {
  if (cachedVertexToken && cachedVertexToken.expiresAt > Date.now() + 60_000) return cachedVertexToken.value;
  const account = readVertexServiceAccount();
  if (!account) throw new Error("Google service account JSON eksik veya geçersiz");
  const now = Math.floor(Date.now() / 1000);
  const tokenUri = account.token_uri ?? "https://oauth2.googleapis.com/token";
  const header = base64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = base64Url(JSON.stringify({
    iss: account.client_email,
    scope: "https://www.googleapis.com/auth/cloud-platform",
    aud: tokenUri,
    iat: now,
    exp: now + 3600,
  }));
  const unsigned = `${header}.${claims}`;
  const signer = createSign("RSA-SHA256");
  signer.update(unsigned);
  signer.end();
  const assertion = `${unsigned}.${base64Url(signer.sign(account.private_key))}`;
  const response = await timedFetch(tokenUri, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion }),
  });
  const payload = await responseJson<{ access_token?: string; expires_in?: number }>(response, "vertex_oauth");
  if (!payload.access_token) throw new Error("Vertex access token üretilemedi");
  cachedVertexToken = { value: payload.access_token, expiresAt: Date.now() + (payload.expires_in ?? 3600) * 1000 };
  return cachedVertexToken.value;
}

function readVertexServiceAccount() {
  try {
    const account = JSON.parse(process.env.GOOGLE_VERTEX_SERVICE_ACCOUNT_JSON ?? "") as {
      client_email?: string;
      private_key?: string;
      token_uri?: string;
    };
    return account.client_email && account.private_key
      ? { client_email: account.client_email, private_key: account.private_key, token_uri: account.token_uri }
      : null;
  } catch {
    return null;
  }
}

function base64Url(value: string | Buffer) {
  return Buffer.from(value).toString("base64url");
}

function vertexHits(payload: VertexPayload): FederatedSearchHit[] {
  const hits = new Map<string, FederatedSearchHit>();
  for (const candidate of payload.candidates ?? []) {
    const chunks = candidate.groundingMetadata?.groundingChunks ?? [];
    const supports = candidate.groundingMetadata?.groundingSupports ?? [];
    for (const [index, chunk] of chunks.entries()) {
      const url = chunk.web?.uri;
      if (!url) continue;
      const descriptions = supports
        .filter((support) => support.groundingChunkIndices?.includes(index))
        .map((support) => support.segment?.text)
        .filter((value): value is string => Boolean(value));
      hits.set(url, { url, title: chunk.web?.title, description: descriptions.join(" ") || undefined });
    }
  }
  return [...hits.values()];
}

type BravePayload = { query?: { more_results_available?: boolean }; web?: { results?: Array<{ title?: string; url?: string; description?: string; extra_snippets?: string[]; age?: string; profile?: { name?: string } }> } };
type TavilyPayload = { results?: Array<{ title?: string; url?: string; content?: string }>; request_id?: string };
type ExaPayload = { results?: Array<{ title?: string; url?: string; text?: string; highlights?: string[] }>; requestId?: string; costDollars?: { total?: number } };
type VertexPayload = { candidates?: Array<{ groundingMetadata?: { groundingChunks?: Array<{ web?: { uri?: string; title?: string } }>; groundingSupports?: Array<{ groundingChunkIndices?: number[]; segment?: { text?: string } }> } }> };

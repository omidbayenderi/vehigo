import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/lib/supabase/types";

type Client = SupabaseClient<Database>;
type Listing = Database["public"]["Tables"]["market_listings"]["Row"];
type Watchlist = Database["public"]["Tables"]["watchlists"]["Row"];

export type ArbitrageAssessment = {
  approved: boolean;
  confidence: number;
  comparableCount: number;
  medianComparablePrice: number | null;
  estimatedNetProfitPercent: number | null;
  reason: string;
  aiUsed: boolean;
};

const INPUT_USD_PER_MILLION = 1;
const OUTPUT_USD_PER_MILLION = 6;

export function calculateConservativeArbitrage(purchasePrice: number, comparablePrices: number[]) {
  if (purchasePrice <= 0 || comparablePrices.length < 3) return null;
  const sorted = [...comparablePrices].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
  const reserve = purchasePrice * 0.1;
  const totalCost = purchasePrice + reserve;
  const netProfitPercent = ((median - totalCost) / totalCost) * 100;
  return { median, reserve, totalCost, netProfitPercent };
}

export async function assessEuropeanArbitrage(
  supabase: Client,
  listing: Listing,
  watchlist: Watchlist,
): Promise<ArbitrageAssessment> {
  if (!process.env.OPENAI_API_KEY) return rejected("OPENAI_API_KEY tanımlı değil");
  if (listing.currency !== "EUR" || !listing.price || !listing.brand || !listing.model) {
    return rejected("EUR fiyatı veya marka/model bilgisi eksik");
  }

  let query = supabase
    .from("market_listings")
    .select("id,title,price,year,mileage_km,seller_country,listing_url")
    .eq("status", "active")
    .eq("currency", "EUR")
    .ilike("brand", listing.brand)
    .ilike("model", listing.model)
    .neq("id", listing.id)
    .not("price", "is", null)
    .order("last_seen_at", { ascending: false })
    .limit(12);
  if (listing.year) query = query.gte("year", listing.year - 3).lte("year", listing.year + 3);
  const { data: comparables, error } = await query;
  if (error) return rejected(`Karşılaştırma verisi okunamadı: ${error.message}`);
  const prices = (comparables ?? []).map((item) => item.price).filter((price): price is number => typeof price === "number" && price > 0);
  const math = calculateConservativeArbitrage(listing.price, prices);
  if (!math || math.netProfitPercent < 40) {
    return { ...rejected("10% maliyet rezervinden sonra matematiksel marj %40 altında"), comparableCount: prices.length, medianComparablePrice: math?.median ?? null, estimatedNetProfitPercent: math?.netProfitPercent ?? null };
  }

  const spent = await currentMonthSpend(supabase);
  const hardLimit = Number.parseFloat(process.env.OPENAI_MONTHLY_BUDGET_USD ?? "10");
  if (spent >= hardLimit) return rejected(`Aylık AI sert limiti doldu ($${hardLimit.toFixed(2)})`);

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { authorization: `Bearer ${process.env.OPENAI_API_KEY}`, "content-type": "application/json" },
    body: JSON.stringify({
      model: process.env.OPENAI_ARBITRAGE_MODEL ?? "gpt-5.6-luna",
      reasoning: { effort: "low" },
      input: [
        { role: "system", content: "You are a conservative European vehicle arbitrage auditor. Never invent data. Approve only when the supplied comparables genuinely support the margin and data quality is sufficient." },
        { role: "user", content: JSON.stringify({ candidate: { title: listing.title, price: listing.price, currency: listing.currency, brand: listing.brand, model: listing.model, year: listing.year, mileage_km: listing.mileage_km, country: listing.seller_country, source: listing.source_key }, watchlist: { name: watchlist.name }, conservative_math: math, comparables }) },
      ],
      text: { format: { type: "json_schema", name: "arbitrage_assessment", strict: true, schema: { type: "object", additionalProperties: false, properties: { approved: { type: "boolean" }, confidence: { type: "number", minimum: 0, maximum: 1 }, reason: { type: "string" } }, required: ["approved", "confidence", "reason"] } } },
      max_output_tokens: 500,
    }),
    signal: AbortSignal.timeout(30_000),
  });
  const payload = await response.json().catch(() => null) as OpenAIResponse | null;
  if (!response.ok || !payload) return rejected(`AI değerlendirmesi başarısız: HTTP ${response.status}`);
  const text = payload.output?.flatMap((item) => item.content ?? []).find((item) => item.type === "output_text")?.text;
  if (!text) return rejected("AI yapılandırılmış cevap üretmedi");
  let ai: { approved: boolean; confidence: number; reason: string };
  try { ai = JSON.parse(text) as typeof ai; } catch { return rejected("AI cevabı geçerli JSON değildi"); }
  const costUsd = ((payload.usage?.input_tokens ?? 0) * INPUT_USD_PER_MILLION + (payload.usage?.output_tokens ?? 0) * OUTPUT_USD_PER_MILLION) / 1_000_000;
  await supabase.from("audit_log").insert({ actor_id: watchlist.user_id, action: "ai_arbitrage_usage", entity_type: "market_listing", entity_id: listing.id, metadata: { cost_usd: costUsd, input_tokens: payload.usage?.input_tokens ?? 0, output_tokens: payload.usage?.output_tokens ?? 0, model: process.env.OPENAI_ARBITRAGE_MODEL ?? "gpt-5.6-luna" } as Json });

  return { approved: ai.approved && ai.confidence >= 0.75, confidence: ai.confidence, comparableCount: prices.length, medianComparablePrice: math.median, estimatedNetProfitPercent: math.netProfitPercent, reason: ai.reason, aiUsed: true };
}

async function currentMonthSpend(supabase: Client) {
  const start = new Date();
  start.setUTCDate(1); start.setUTCHours(0, 0, 0, 0);
  const { data } = await supabase.from("audit_log").select("metadata").eq("action", "ai_arbitrage_usage").gte("created_at", start.toISOString()).limit(5000);
  return (data ?? []).reduce((sum, row) => {
    const metadata = row.metadata;
    if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return sum;
    const value = metadata.cost_usd;
    return sum + (typeof value === "number" ? value : 0);
  }, 0);
}

function rejected(reason: string): ArbitrageAssessment {
  return { approved: false, confidence: 0, comparableCount: 0, medianComparablePrice: null, estimatedNetProfitPercent: null, reason, aiUsed: false };
}

type OpenAIResponse = { output?: Array<{ content?: Array<{ type?: string; text?: string }> }>; usage?: { input_tokens?: number; output_tokens?: number } };

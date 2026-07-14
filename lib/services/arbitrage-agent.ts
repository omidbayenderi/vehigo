import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { analyzeMarketListing } from "./market-intelligence";
import { runAiMarketReview } from "./ai-evaluation-ledger";

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
  if (listing.currency !== "EUR" || !listing.price || !listing.brand || !listing.model) {
    return rejected("EUR fiyatı veya marka/model bilgisi eksik");
  }
  try {
    const snapshot = await analyzeMarketListing(supabase, listing.id);
    const distribution = snapshot.distribution && typeof snapshot.distribution === "object" && !Array.isArray(snapshot.distribution) ? snapshot.distribution : {};
    const median = typeof distribution.median === "number" ? distribution.median : null;
    const math = median ? calculateConservativeArbitrage(listing.price, [median, median, median]) : null;
    if (!snapshot.claim_eligible || !math || math.netProfitPercent < 40 || snapshot.risk_level === "critical") {
      return { ...rejected(!snapshot.claim_eligible ? "Örneklem kalitesi ticari arbitraj iddiası için yetersiz" : snapshot.risk_level === "critical" ? "Kritik risk sinyali nedeniyle arbitraj yayını engellendi" : "10% maliyet rezervinden sonra matematiksel marj %40 altında"), comparableCount: snapshot.comparable_count, medianComparablePrice: median, estimatedNetProfitPercent: math?.netProfitPercent ?? null };
    }
    const evaluation = await runAiMarketReview(supabase, watchlist.user_id, snapshot);
    const output = evaluation.output && typeof evaluation.output === "object" && !Array.isArray(evaluation.output) ? evaluation.output : {};
    const confidence = typeof output.confidence === "number" ? output.confidence : 0;
    const reason = typeof output.summary === "string" ? output.summary : evaluation.error ?? "AI kanıt incelemesi tamamlanmadı";
    return { approved: evaluation.status === "completed" && confidence >= 0.75, confidence, comparableCount: snapshot.comparable_count, medianComparablePrice: median, estimatedNetProfitPercent: math.netProfitPercent, reason, aiUsed: evaluation.status === "completed" };
  } catch (error) {
    return rejected(error instanceof Error ? error.message : "Piyasa istihbaratı oluşturulamadı");
  }
}

function rejected(reason: string): ArbitrageAssessment {
  return { approved: false, confidence: 0, comparableCount: 0, medianComparablePrice: null, estimatedNetProfitPercent: null, reason, aiUsed: false };
}

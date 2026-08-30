import type { SupabaseClient } from "@supabase/supabase-js";
import type { MarketListingInput } from "@/lib/domain/listings";
import type { Database, Json } from "@/lib/supabase/types";
import { normalizeMarketListing } from "@/lib/normalization/normalize-listing";
import { marketListingInputSchema, canonicalMarketListingInputSchema } from "@/lib/validation/schemas";
import { evaluateListingForWatchlist, isListingEligibleForNotification } from "@/lib/search/matcher";
import { assessOpportunity } from "@/lib/services/opportunity-agents";
import {
  calculateCommercialOpportunity,
  profileFromWatchlist,
  type CommercialOpportunityAssessment,
} from "@/lib/services/commercial-opportunity";
import { meetsArbitrageSaleToCostMultiple } from "@/lib/services/arbitrage-agent";
import { sendTelegramMessage } from "@/lib/services/notifications";
import {
  claimTransientDeliveryReceipts,
  completeTransientDeliveryReceipts,
  receiptClaimKey,
  releaseTransientDeliveryReceipts,
  transientReceiptHash,
  type TransientReceiptCandidate,
} from "@/lib/services/transient-delivery-receipts";

type Client = SupabaseClient<Database>;
type Listing = Database["public"]["Tables"]["market_listings"]["Row"];
type Watchlist = Database["public"]["Tables"]["watchlists"]["Row"];
type TransientMatch = {
  listing: Listing;
  watchlist: Watchlist;
  commercial: CommercialOpportunityAssessment | null;
  relevanceScore: number;
};

export type TransientProcessingResult = {
  fetched: number;
  inserted: 0;
  alertsCreated: number;
  alertsSent: number;
  alertsFailed: number;
  rejected: number;
  deferred: 0;
};

export async function processTransientListings(
  supabase: Client,
  inputs: MarketListingInput[],
  watchlists: Watchlist[],
): Promise<TransientProcessingResult> {
  const result: TransientProcessingResult = {
    fetched: inputs.length,
    inserted: 0,
    alertsCreated: 0,
    alertsSent: 0,
    alertsFailed: 0,
    rejected: 0,
    deferred: 0,
  };
  const listings: Listing[] = [];
  for (const input of inputs) {
    try {
      listings.push(transientListing(input));
    } catch {
      result.rejected++;
    }
  }
  const userIds = [...new Set(watchlists.map((watchlist) => watchlist.user_id))];
  if (userIds.length === 0 || listings.length === 0) return result;

  const { data: profiles, error: profileError } = await supabase
    .from("users_profile")
    .select("id,telegram_chat_id,telegram_verified_at,locale")
    .in("id", userIds)
    .not("telegram_chat_id", "is", null)
    .not("telegram_verified_at", "is", null);
  if (profileError) throw new Error(profileError.message);
  const chatByUser = new Map((profiles ?? []).flatMap((profile) =>
    profile.telegram_chat_id ? [[profile.id, { chatId: profile.telegram_chat_id, locale: profile.locale }] as const] : [],
  ));
  const matchesByUser = new Map<string, TransientMatch[]>();
  const seenByUser = new Map<string, Set<string>>();

  for (const listing of listings) {
    for (const watchlist of watchlists) {
      if (!chatByUser.has(watchlist.user_id)) continue;
      const evaluation = evaluateListingForWatchlist(listing, watchlist);
      if (!isListingEligibleForNotification(listing, watchlist, evaluation)) continue;
      const seen = seenByUser.get(watchlist.user_id) ?? new Set<string>();
      if (seen.has(listing.listing_url)) continue;
      seen.add(listing.listing_url);
      seenByUser.set(watchlist.user_id, seen);
      const matches = matchesByUser.get(watchlist.user_id) ?? [];
      matches.push({
        listing,
        watchlist,
        commercial: assessTransientCommercialOpportunity(listing, watchlist, listings),
        relevanceScore: evaluation.score,
      });
      matchesByUser.set(watchlist.user_id, matches);
    }
  }

  for (const [userId, unsortedMatches] of matchesByUser) {
    const matches = unsortedMatches
      .sort((left, right) =>
        right.relevanceScore - left.relevanceScore
        || assessOpportunity(right.listing, right.watchlist).score - assessOpportunity(left.listing, left.watchlist).score
        || Number(Boolean(right.listing.price)) - Number(Boolean(left.listing.price)),
      )
      .slice(0, 5);
    const recipient = chatByUser.get(userId);
    if (!recipient || matches.length === 0) continue;
    const candidates = matches.map(({ listing, watchlist }) => receiptCandidate(listing, watchlist));
    const claimed = await claimTransientDeliveryReceipts(supabase, candidates);
    const deliverable = matches.flatMap((match, index) => {
      const candidate = candidates[index];
      const hash = transientReceiptHash(candidate);
      const claim = claimed.get(receiptClaimKey(candidate, hash));
      return claim ? [{ match, claim }] : [];
    });
    if (deliverable.length === 0) continue;
    result.alertsCreated += deliverable.length;
    const delivery = await sendTelegramMessage(
      recipient.chatId,
      formatTransientDigest(deliverable.map(({ match }) => match), recipient.locale),
    );
    const deliveryClaims = deliverable.map(({ claim }) => claim);
    if (delivery.ok) {
      await completeTransientDeliveryReceipts(supabase, userId, deliveryClaims);
      result.alertsSent++;
      await dispatchTransientChannelMessages(deliverable.map(({ match }) => match), recipient.locale);
    } else {
      await releaseTransientDeliveryReceipts(supabase, userId, deliveryClaims);
      result.alertsFailed++;
    }
  }
  return result;
}

async function dispatchTransientChannelMessages(matches: TransientMatch[], locale: "tr" | "fa") {
  if (process.env.TELEGRAM_TRANSIENT_CHANNELS_ENABLED !== "true") return;
  const criteriaChannel = process.env.TELEGRAM_CRITERIA_CHANNEL ?? "@Vehigo_Kriter";
  const opportunityChannel = process.env.TELEGRAM_OPPORTUNITY_CHANNEL ?? "@Vehigo_Firsat";
  const arbitrageChannel = process.env.TELEGRAM_ARBITRAGE_CHANNEL ?? "@Vehigo_Arbitraj";
  const deliveries: Array<{ destination: string; promise: ReturnType<typeof sendTelegramMessage> }> = [];
  if (criteriaChannel) {
    deliveries.push({
      destination: criteriaChannel,
      promise: sendTelegramMessage(criteriaChannel, `<b>KRİTER EŞLEŞMESİ</b>\n${formatTransientDigest(matches, locale)}`),
    });
  }
  const opportunities = matches.filter(({ listing, watchlist }) => assessOpportunity(listing, watchlist).score >= 65);
  if (opportunities.length > 0 && opportunityChannel) {
    deliveries.push({
      destination: opportunityChannel,
      promise: sendTelegramMessage(opportunityChannel, `<b>FIRSAT EŞLEŞMESİ</b>\n${formatTransientDigest(opportunities, locale)}`),
    });
  }
  const arbitrage = matches.filter(({ commercial }) =>
    commercial?.approved && meetsArbitrageSaleToCostMultiple(commercial),
  );
  if (arbitrage.length > 0 && arbitrageChannel) {
    deliveries.push({
      destination: arbitrageChannel,
      promise: sendTelegramMessage(arbitrageChannel, `<b>KANITLI ARBİTRAJ FIRSATI</b>\n${formatTransientDigest(arbitrage, locale)}`),
    });
  }

  const settled = await Promise.allSettled(deliveries.map(({ promise }) => promise));
  settled.forEach((outcome, index) => {
    const failed = outcome.status === "rejected"
      || (outcome.status === "fulfilled" && !outcome.value.ok);
    if (failed) console.error(`[transient-channel] delivery_failed destination=${deliveries[index].destination}`);
  });
}

function receiptCandidate(listing: Listing, watchlist: Watchlist): TransientReceiptCandidate {
  return {
    organizationId: watchlist.organization_id,
    userId: watchlist.user_id,
    sourceKey: listing.source_key,
    sourceIdentity: listing.source_listing_id || listing.listing_url,
  };
}

function transientListing(input: MarketListingInput): Listing {
  const parsed = canonicalMarketListingInputSchema.parse(
    normalizeMarketListing(marketListingInputSchema.parse(input)),
  );
  const now = new Date().toISOString();
  return {
    id: `transient:${parsed.canonical_fingerprint}`,
    source_key: parsed.source_key,
    source_listing_id: parsed.source_listing_id ?? parsed.listing_url,
    listing_url: parsed.listing_url,
    title: parsed.title ?? null,
    seller_name: parsed.seller_name ?? null,
    seller_country: parsed.seller_country ?? null,
    seller_country_code: parsed.seller_country_code ?? null,
    seller_city: parsed.seller_city ?? null,
    brand: parsed.brand ?? null,
    model: parsed.model ?? null,
    year: parsed.year ?? null,
    mileage_km: parsed.mileage_km ?? null,
    price: parsed.price ?? null,
    currency: parsed.currency,
    vehicle_type: parsed.vehicle_type ?? null,
    description: parsed.description ?? null,
    seat_count: parsed.seat_count ?? null,
    condition: parsed.condition ?? null,
    normalization_confidence: parsed.normalization_confidence,
    raw: { discovery_channel: "federated_search", ...(parsed.raw ?? {}) } as Json,
    status: "active",
    delisted_at: null,
    first_seen_at: now,
    last_seen_at: now,
    created_at: now,
    updated_at: now,
  };
}

function formatTransientDigest(matches: TransientMatch[], locale: "tr" | "fa") {
  const t = locale === "fa"
    ? {
      header: "<b>خلاصه جست‌وجوی موقت Vehigo</b>",
      subheader: "محتوای آگهی ذخیره نشد؛ فقط یک رسید رمزنگاری‌شده برای جلوگیری از اعلان تکراری نگهداری می‌شود.",
      untitled: "آگهی خودرو",
      alarm: "هشدار",
      score: "امتیاز",
      price: "قیمت",
      location: "موقعیت",
      reason: "دلیل",
      evidence: "شواهد بازار همان نوبت",
      profit: "سود خالص تخمینی",
      open: "مشاهده آگهی",
    }
    : {
      header: "<b>Vehigo geçici arama özeti</b>",
      subheader: "İlan içeriği kaydedilmedi; yalnızca tekrar bildirimini önleyen şifreli teslimat izi tutuldu.",
      untitled: "Araç ilanı",
      alarm: "Alarm",
      score: "Skor",
      price: "Fiyat",
      location: "Konum",
      reason: "Neden",
      evidence: "Aynı tur piyasa kanıtı",
      profit: "Tahmini net kâr",
      open: "İlanı aç",
    };
  const lines = [t.header, t.subheader, ""];
  for (const [index, { listing, watchlist, commercial }] of matches.entries()) {
    const opportunity = assessOpportunity(listing, watchlist);
    const title = listing.title || [listing.brand, listing.model, listing.year].filter(Boolean).join(" ") || t.untitled;
    const price = listing.price === null ? "-" : `${listing.price.toLocaleString("tr-TR")} ${listing.currency}`;
    const location = [listing.seller_city, listing.seller_country].filter(Boolean).join(", ") || "-";
    lines.push(
      `${index + 1}. <b>${escapeHtml(title)}</b>`,
      `${t.alarm}: ${escapeHtml(watchlist.name)} | ${t.score}: ${opportunity.score}/100`,
      `${t.price}: ${escapeHtml(price)} | ${t.location}: ${escapeHtml(location)}`,
      opportunity.reasons[0] ? `${t.reason}: ${escapeHtml(opportunity.reasons[0])}` : "",
      commercial?.medianComparablePrice !== null && commercial?.medianComparablePrice !== undefined
        ? `${t.evidence}: ${commercial.comparableCount} ilan / ${commercial.sourceCount} kaynak · Medyan ${commercial.medianComparablePrice.toLocaleString("tr-TR")} ${listing.currency}`
        : "",
      commercial?.approved && commercial.estimatedNetProfit !== null
        ? `🔥 ${t.profit}: ${commercial.estimatedNetProfit.toLocaleString("tr-TR")} ${listing.currency} · %${commercial.estimatedNetMarginPercent?.toFixed(1) ?? "-"}`
        : "",
      `<a href="${escapeHtml(listing.listing_url)}">${t.open}</a>`,
      "",
    );
  }
  return lines.filter(Boolean).join("\n");
}

export function assessTransientCommercialOpportunity(
  listing: Listing,
  watchlist: Watchlist,
  batch: Listing[],
): CommercialOpportunityAssessment | null {
  if (!listing.price || listing.currency !== watchlist.currency || !listing.brand || !listing.model) return null;
  const brand = normalizeComparableText(listing.brand);
  const model = normalizeComparableText(listing.model);
  const comparables = batch.filter((candidate) =>
    candidate.source_listing_id !== listing.source_listing_id
    && candidate.price !== null
    && candidate.price > 0
    && candidate.currency === listing.currency
    && normalizeComparableText(candidate.brand) === brand
    && normalizeComparableText(candidate.model) === model,
  );
  const prices = comparables.map((candidate) => candidate.price!).sort((a, b) => a - b);
  const medianComparablePrice = median(prices);
  const sourceCount = new Set(comparables.map((candidate) => candidate.source_key)).size;
  const confidence = Math.min(0.9, 0.45 + Math.min(prices.length, 12) * 0.03 + Math.min(sourceCount, 4) * 0.05);
  return calculateCommercialOpportunity({
    purchasePrice: listing.price,
    medianComparablePrice,
    comparableCount: prices.length,
    sourceCount,
    confidence,
    riskLevel: listing.condition === "damaged" ? "critical" : "unknown",
    profile: profileFromWatchlist(watchlist),
  });
}

function normalizeComparableText(value: string | null) {
  return value?.trim().toLocaleLowerCase("en-US") ?? "";
}

function median(values: number[]) {
  if (values.length === 0) return null;
  const middle = Math.floor(values.length / 2);
  return values.length % 2 === 0 ? (values[middle - 1] + values[middle]) / 2 : values[middle];
}

function escapeHtml(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

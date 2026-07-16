import type { SupabaseClient } from "@supabase/supabase-js";
import type { MarketListingInput } from "@/lib/domain/listings";
import type { Database, Json } from "@/lib/supabase/types";
import { normalizeMarketListing } from "@/lib/normalization/normalize-listing";
import { marketListingInputSchema, canonicalMarketListingInputSchema } from "@/lib/validation/schemas";
import { listingMatchesWatchlist } from "@/lib/services/market-alerts";
import { assessOpportunity } from "@/lib/services/opportunity-agents";
import { sendTelegramMessage } from "@/lib/services/notifications";

type Client = SupabaseClient<Database>;
type Listing = Database["public"]["Tables"]["market_listings"]["Row"];
type Watchlist = Database["public"]["Tables"]["watchlists"]["Row"];

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
  const matchesByUser = new Map<string, Array<{ listing: Listing; watchlist: Watchlist }>>();
  const seenByUser = new Map<string, Set<string>>();

  for (const listing of listings) {
    for (const watchlist of watchlists) {
      if (!chatByUser.has(watchlist.user_id) || !listingMatchesWatchlist(listing, watchlist)) continue;
      const seen = seenByUser.get(watchlist.user_id) ?? new Set<string>();
      if (seen.has(listing.listing_url)) continue;
      seen.add(listing.listing_url);
      seenByUser.set(watchlist.user_id, seen);
      const matches = matchesByUser.get(watchlist.user_id) ?? [];
      if (matches.length < 5) matches.push({ listing, watchlist });
      matchesByUser.set(watchlist.user_id, matches);
      result.alertsCreated++;
    }
  }

  for (const [userId, matches] of matchesByUser) {
    const recipient = chatByUser.get(userId);
    if (!recipient || matches.length === 0) continue;
    const delivery = await sendTelegramMessage(recipient.chatId, formatTransientDigest(matches, recipient.locale));
    if (delivery.ok) result.alertsSent++;
    else result.alertsFailed++;
  }
  return result;
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
    raw: { ...(parsed.raw ?? {}), discovery_channel: "brave_web" } as Json,
    status: "active",
    delisted_at: null,
    first_seen_at: now,
    last_seen_at: now,
    created_at: now,
    updated_at: now,
  };
}

function formatTransientDigest(matches: Array<{ listing: Listing; watchlist: Watchlist }>, locale: "tr" | "fa") {
  const t = locale === "fa"
    ? {
      header: "<b>خلاصه جست‌وجوی موقت Vehigo</b>",
      subheader: "نتایج بدون ذخیره‌سازی پردازش شدند.",
      untitled: "آگهی خودرو",
      alarm: "هشدار",
      score: "امتیاز",
      price: "قیمت",
      location: "موقعیت",
      reason: "دلیل",
      open: "مشاهده آگهی",
    }
    : {
      header: "<b>Vehigo geçici arama özeti</b>",
      subheader: "Sonuçlar kaydedilmeden işlendi.",
      untitled: "Araç ilanı",
      alarm: "Alarm",
      score: "Skor",
      price: "Fiyat",
      location: "Konum",
      reason: "Neden",
      open: "İlanı aç",
    };
  const lines = [t.header, t.subheader, ""];
  for (const [index, { listing, watchlist }] of matches.entries()) {
    const opportunity = assessOpportunity(listing, watchlist);
    const title = listing.title || [listing.brand, listing.model, listing.year].filter(Boolean).join(" ") || t.untitled;
    const price = listing.price === null ? "-" : `${listing.price.toLocaleString("tr-TR")} ${listing.currency}`;
    const location = [listing.seller_city, listing.seller_country].filter(Boolean).join(", ") || "-";
    lines.push(
      `${index + 1}. <b>${escapeHtml(title)}</b>`,
      `${t.alarm}: ${escapeHtml(watchlist.name)} | ${t.score}: ${opportunity.score}/100`,
      `${t.price}: ${escapeHtml(price)} | ${t.location}: ${escapeHtml(location)}`,
      opportunity.reasons[0] ? `${t.reason}: ${escapeHtml(opportunity.reasons[0])}` : "",
      `<a href="${escapeHtml(listing.listing_url)}">${t.open}</a>`,
      "",
    );
  }
  return lines.filter(Boolean).join("\n");
}

function escapeHtml(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

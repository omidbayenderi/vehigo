import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { sendTelegramMessage } from "@/lib/services/notifications";
import { checkScannerHealth, formatScannerHealthWarning } from "@/lib/services/scanner-health";

type Client = SupabaseClient<Database>;
type Listing = Database["public"]["Tables"]["market_listings"]["Row"];
type Alert = Database["public"]["Tables"]["listing_alerts"]["Row"];
type Watchlist = Database["public"]["Tables"]["watchlists"]["Row"];
type UserProfile = Database["public"]["Tables"]["users_profile"]["Row"];

type DigestAlert = Alert & {
  market_listings: Listing | null;
  watchlists: Watchlist | null;
  users_profile: UserProfile | null;
};

export async function sendOpportunityDigest(supabase: Client, options: { hours?: number; limitPerUser?: number } = {}) {
  const hours = options.hours ?? 24;
  const limitPerUser = options.limitPerUser ?? 5;
  const since = new Date(Date.now() - hours * 3_600_000).toISOString();

  const { data, error } = await supabase
    .from("listing_alerts")
    .select("*, market_listings(*), watchlists(*), users_profile(*)")
    .gte("created_at", since)
    .order("opportunity_score", { ascending: false, nullsFirst: false });
  if (error) throw new Error(error.message);

  const grouped = new Map<string, DigestAlert[]>();
  for (const alert of (data ?? []) as unknown as DigestAlert[]) {
    if (!alert.users_profile?.telegram_chat_id || !alert.market_listings) continue;
    const bucket = grouped.get(alert.user_id) ?? [];
    if (bucket.length < limitPerUser) bucket.push(alert);
    grouped.set(alert.user_id, bucket);
  }

  const healthIssues = await checkScannerHealth(supabase);
  const healthWarning = healthIssues.length > 0 ? formatScannerHealthWarning(healthIssues) : null;

  const recipients = new Map<string, { chatId: string; alerts: DigestAlert[] }>();
  for (const [userId, alerts] of grouped) {
    const chatId = alerts[0]?.users_profile?.telegram_chat_id;
    if (chatId) recipients.set(userId, { chatId, alerts });
  }

  if (healthWarning) {
    const { data: profiles, error: profilesError } = await supabase
      .from("users_profile")
      .select("id,telegram_chat_id")
      .not("telegram_chat_id", "is", null);
    if (profilesError) throw new Error(profilesError.message);
    for (const profile of profiles ?? []) {
      if (!profile.telegram_chat_id) continue;
      if (!recipients.has(profile.id)) {
        recipients.set(profile.id, { chatId: profile.telegram_chat_id, alerts: [] });
      }
    }
  }

  let sent = 0;
  let skipped = 0;
  let failed = 0;

  for (const { chatId, alerts } of recipients.values()) {
    const messageParts = [
      alerts.length > 0 ? formatDigest(alerts, hours) : null,
      healthWarning,
    ].filter((part): part is string => Boolean(part));

    if (messageParts.length === 0) {
      skipped++;
      continue;
    }

    const result = await sendTelegramMessage(chatId, messageParts.join("\n\n"));
    if (result.ok) sent++;
    else failed++;
  }

  return { users: recipients.size, sent, skipped, failed, healthIssues: healthIssues.length };
}

function formatDigest(alerts: DigestAlert[], hours: number) {
  const lines = [
    `Vehigo fırsat özeti - son ${hours} saat`,
    ``,
    ...alerts.flatMap((alert, index) => {
      const listing = alert.market_listings;
      const watchlist = alert.watchlists;
      if (!listing) return [];
      const title = listing.title || [listing.brand, listing.model, listing.year].filter(Boolean).join(" ");
      const price = listing.price === null ? "-" : `${listing.price.toLocaleString("tr-TR")} ${listing.currency}`;
      const location = [listing.seller_city, listing.seller_country].filter(Boolean).join(", ") || "-";
      const reasons = Array.isArray(alert.opportunity_reasons) ? alert.opportunity_reasons : [];

      return [
        `${index + 1}. [${labelText(alert.opportunity_label)}] ${escapeHtml(title || "Araç ilanı")}`,
        `Skor: ${alert.opportunity_score ?? "-"}/100 | Kural: ${escapeHtml(watchlist?.name ?? "-")}`,
        `Fiyat: ${escapeHtml(price)} | Konum: ${escapeHtml(location)} | Kaynak: ${escapeHtml(listing.source_key)}`,
        reasons[0] ? `Neden: ${escapeHtml(String(reasons[0]))}` : null,
        `<a href="${escapeHtml(listing.listing_url)}">İlanı aç</a>`,
        ``,
      ].filter(Boolean) as string[];
    }),
  ];

  return lines.join("\n");
}

function labelText(label: DigestAlert["opportunity_label"]) {
  if (label === "hot") return "HOT";
  if (label === "good") return "GOOD";
  if (label === "watch") return "WATCH";
  return "INFO";
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

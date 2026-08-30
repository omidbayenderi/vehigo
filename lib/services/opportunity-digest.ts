import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, VehicleCondition } from "@/lib/supabase/types";
import { sendTelegramMessage } from "@/lib/services/notifications";
import { checkScannerHealth, criticalScannerHealthIssues, type ScannerHealthIssue } from "@/lib/services/scanner-health";
import { readListingCondition, readListingSeatCount } from "@/lib/services/market-alerts";
import { assessEuropeanArbitrage, type ArbitrageAssessment } from "@/lib/services/arbitrage-agent";
import { isListingEligibleForNotification } from "@/lib/search/matcher";

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

export async function sendOpportunityDigest(
  supabase: Client,
  options: { hours?: number; limitPerUser?: number; userId?: string } = {},
) {
  const hours = options.hours ?? 12;
  const limitPerUser = options.limitPerUser ?? 5;

  let pendingQuery = supabase
    .from("listing_alerts")
    .select("*, market_listings(*), watchlists!watchlist_id(*), users_profile(*)")
    .eq("status", "pending")
    .is("sent_at", null)
    .order("opportunity_score", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: true })
    .limit(1000);
  if (options.userId) pendingQuery = pendingQuery.eq("user_id", options.userId);

  const { data, error } = await pendingQuery;
  if (error) throw new Error(error.message);

  const candidateUsers = new Map<string, { chatId: string; locale: "tr" | "fa" }>();
  for (const alert of (data ?? []) as unknown as DigestAlert[]) {
    if (!isUnsentDigestAlert(alert)) continue;
    if (!alert.users_profile?.telegram_chat_id || !alert.market_listings) continue;
    candidateUsers.set(alert.user_id, {
      chatId: alert.users_profile.telegram_chat_id,
      locale: alert.users_profile.locale,
    });
  }

  const healthIssues = criticalScannerHealthIssues(await checkScannerHealth(supabase));
  if (healthIssues.length > 0) {
    const { data: linkedProfiles, error: profilesError } = await supabase
      .from("users_profile")
      .select("id,telegram_chat_id,telegram_verified_at,locale")
      .not("telegram_chat_id", "is", null)
      .not("telegram_verified_at", "is", null);
    if (profilesError) throw new Error(profilesError.message);
    for (const profile of linkedProfiles ?? []) {
      if (profile.telegram_chat_id) candidateUsers.set(profile.id, { chatId: profile.telegram_chat_id, locale: profile.locale });
    }
  }
  let users = 0;
  let sent = 0;
  let skipped = 0;
  let failed = 0;
  let pendingAlerts = 0;

  for (const [userId, { chatId, locale }] of candidateUsers) {
    const claimToken = crypto.randomUUID();
    const { data: claimed, error: claimError } = await supabase.rpc("claim_opportunity_digest_alerts", {
      p_claim_token: claimToken,
      p_limit: limitPerUser,
      p_user_id: userId,
      p_lease_seconds: 900,
    });
    if (claimError) throw new Error(`digest_claim_failed: ${claimError.message}`);
    const claimedIds = (claimed ?? []).map((alert) => alert.id);
    let alerts: DigestAlert[] = [];
    if (claimedIds.length > 0) {
      const { data: claimedAlerts, error: claimedError } = await supabase
        .from("listing_alerts")
        .select("*, market_listings(*), watchlists!watchlist_id(*), users_profile(*)")
        .in("id", claimedIds)
        .eq("digest_claim_token", claimToken);
      if (claimedError) throw new Error(claimedError.message);
      alerts = (claimedAlerts ?? []) as unknown as DigestAlert[];
    }
    if (alerts.length === 0 && healthIssues.length === 0) continue;
    users++;
    pendingAlerts += alerts.length;
    const deliverableAlerts = alerts.filter((alert) =>
      Boolean(alert.market_listings && alert.watchlists
        && isListingEligibleForNotification(alert.market_listings, alert.watchlists)),
    );
    const arbitrageByAlertId = new Map<string, ArbitrageAssessment>();
    for (const alert of deliverableAlerts) {
      if (!alert.market_listings || !alert.watchlists) continue;
      try {
        const assessment = await assessEuropeanArbitrage(supabase, alert.market_listings, alert.watchlists);
        if (assessment.approved) arbitrageByAlertId.set(alert.id, assessment);
      } catch {
        // Arbitrage checking is a bonus signal; a failure here must never block ordinary delivery.
      }
    }
    const healthWarning = healthIssues.length > 0 ? formatHealthWarning(healthIssues, locale) : null;
    const messageParts = [
      deliverableAlerts.length > 0 ? formatDigest(deliverableAlerts, hours, locale, arbitrageByAlertId) : null,
      healthWarning,
    ].filter((part): part is string => Boolean(part));

    if (messageParts.length === 0) {
      if (alerts.length > 0) {
        const filteredIds = alerts.map((alert) => alert.id);
        const { data: finished, error: finishError } = await supabase.rpc("finish_opportunity_digest_alerts", {
          p_claim_token: claimToken,
          p_alert_ids: filteredIds,
          p_sent: true,
          p_error: "filtered_by_notification_quality_gate",
        });
        if (finishError || finished !== filteredIds.length) {
          failed++;
          continue;
        }
      }
      skipped++;
      continue;
    }

    const result = await sendTelegramMessage(chatId, messageParts.join("\n\n"));
    const alertIds = alerts.map((alert) => alert.id);
    if (result.ok) {
      if (alertIds.length === 0) {
        sent++;
        continue;
      }
      const { data: finished, error: finishError } = await supabase.rpc("finish_opportunity_digest_alerts", {
        p_claim_token: claimToken,
        p_alert_ids: alertIds,
        p_sent: true,
        p_error: null,
      });
      if (finishError || finished !== alertIds.length) {
        await markDigestDeliveryUncertain(supabase, claimToken, alertIds, finishError?.message ?? "claim fence changed after Telegram success");
        failed++;
        continue;
      }
      sent++;
    } else {
      if (alertIds.length === 0) {
        failed++;
        continue;
      }
      const { error: finishError } = await supabase.rpc("finish_opportunity_digest_alerts", {
        p_claim_token: claimToken,
        p_alert_ids: alertIds,
        p_sent: false,
        p_error: result.error ?? "Telegram digest delivery failed",
      });
      if (finishError) throw new Error(`digest_failure_record_failed: ${finishError.message}`);
      failed++;
    }
  }

  return {
    users,
    sent,
    skipped,
    failed,
    healthIssues: healthIssues.length,
    pendingAlerts,
  };
}

async function markDigestDeliveryUncertain(
  supabase: Client,
  claimToken: string,
  alertIds: string[],
  reason: string,
) {
  const { error } = await supabase.rpc("mark_opportunity_digest_uncertain", {
    p_claim_token: claimToken,
    p_alert_ids: alertIds,
    p_error: reason,
  });
  if (error) throw new Error(`digest_delivery_uncertain_record_failed: ${error.message}`);
}

export function isUnsentDigestAlert(alert: Pick<Alert, "status" | "sent_at">) {
  return alert.status === "pending" && alert.sent_at === null;
}

export function formatDigest(
  alerts: DigestAlert[],
  hours: number,
  locale: "tr" | "fa" = "tr",
  arbitrageByAlertId: Map<string, ArbitrageAssessment> = new Map(),
) {
  if (locale === "fa") return formatDigestFa(alerts, hours, arbitrageByAlertId);
  const lines = [
    `Vehigo fırsat özeti - ${hours} saatlik dönem ve bekleyenler`,
    ``,
    ...alerts.flatMap((alert, index) => {
      const listing = alert.market_listings;
      const watchlist = alert.watchlists;
      if (!listing) return [];
      const title = listing.title || [listing.brand, listing.model, listing.year].filter(Boolean).join(" ");
      const price = listing.price === null ? "-" : `${listing.price.toLocaleString("tr-TR")} ${listing.currency}`;
      const location = [listing.seller_city, listing.seller_country].filter(Boolean).join(", ") || "-";
      const reasons = Array.isArray(alert.opportunity_reasons) ? alert.opportunity_reasons : [];
      const seatCount = readListingSeatCount(listing);
      const condition = readListingCondition(listing);
      const details = [
        seatCount ? `Koltuk: ${seatCount}` : null,
        condition ? `Durum: ${conditionLabel(condition, "tr")}` : null,
      ].filter(Boolean).join(" | ");
      const arbitrage = arbitrageByAlertId.get(alert.id);

      return [
        arbitrage ? formatArbitrageBlock(arbitrage, "tr") : null,
        `${index + 1}. [${alert.alert_type === "price_drop" ? "FİYAT DÜŞTÜ" : labelText(alert.opportunity_label)}] ${escapeHtml(title || "Araç ilanı")}`,
        `Skor: ${alert.opportunity_score ?? "-"}/100 | Kural: ${escapeHtml(watchlist?.name ?? "-")}`,
        `Fiyat: ${escapeHtml(price)} | Konum: ${escapeHtml(location)} | Kaynak: ${escapeHtml(listing.source_key)}`,
        details || null,
        reasons[0] ? `Neden: ${escapeHtml(String(reasons[0]))}` : null,
        `<a href="${escapeHtml(listing.listing_url)}">İlanı aç</a>`,
        ``,
      ].filter(Boolean) as string[];
    }),
  ];

  return lines.join("\n");
}

function formatDigestFa(alerts: DigestAlert[], hours: number, arbitrageByAlertId: Map<string, ArbitrageAssessment> = new Map()) {
  const lines = [
    `خلاصه فرصت‌های وهیگو — دوره ${hours.toLocaleString("fa-IR")} ساعته و موارد در انتظار`,
    ``,
    ...alerts.flatMap((alert, index) => {
      const listing = alert.market_listings;
      const watchlist = alert.watchlists;
      if (!listing) return [];
      const title = listing.title || [listing.brand, listing.model, listing.year].filter(Boolean).join(" ");
      const price = listing.price === null ? "نامشخص" : `${listing.price.toLocaleString("fa-IR")} ${listing.currency}`;
      const location = [listing.seller_city, listing.seller_country].filter(Boolean).join("، ") || "نامشخص";
      const reasons = Array.isArray(alert.opportunity_reasons) ? alert.opportunity_reasons : [];
      const seatCount = readListingSeatCount(listing);
      const condition = readListingCondition(listing);
      const details = [
        seatCount ? `تعداد صندلی: ${seatCount.toLocaleString("fa-IR")}` : null,
        condition ? `وضعیت: ${conditionLabel(condition, "fa")}` : null,
      ].filter(Boolean).join(" | ");
      const arbitrage = arbitrageByAlertId.get(alert.id);

      return [
        arbitrage ? formatArbitrageBlock(arbitrage, "fa") : null,
        `${(index + 1).toLocaleString("fa-IR")}. [${alert.alert_type === "price_drop" ? "کاهش قیمت" : labelTextFa(alert.opportunity_label)}] ${escapeHtml(title || "آگهی خودرو")}`,
        `امتیاز: ${alert.opportunity_score?.toLocaleString("fa-IR") ?? "-"}/۱۰۰ | هشدار: ${escapeHtml(watchlist?.name ?? "-")}`,
        `قیمت: ${escapeHtml(price)} | مکان: ${escapeHtml(location)} | منبع: ${escapeHtml(listingSource(listing))}`,
        details || null,
        reasons[0] ? `دلیل: ${escapeHtml(translateReasonFa(String(reasons[0])))}` : null,
        `<a href="${escapeHtml(listing.listing_url)}">مشاهده آگهی</a>`,
        ``,
      ].filter(Boolean) as string[];
    }),
  ];
  return lines.join("\n");
}

function formatArbitrageBlock(assessment: ArbitrageAssessment, locale: "tr" | "fa") {
  const margin = assessment.estimatedNetProfitPercent?.toFixed(1) ?? "?";
  const median = assessment.medianComparablePrice?.toLocaleString(locale === "fa" ? "fa-IR" : "tr-TR") ?? "?";
  const confidence = Math.round(assessment.confidence * 100);
  if (locale === "fa") {
    return [
      `🔥 <b>فرصت آربیتراژ واقعی</b>`,
      `سود خالص تخمینی: %${margin}`,
      `میانه مقایسه‌ای: ${median} یورو (${assessment.comparableCount.toLocaleString("fa-IR")} آگهی)`,
      `اطمینان هوش مصنوعی: %${confidence}`,
      `ارزیابی: ${escapeHtml(assessment.reason)}`,
    ].join("\n");
  }
  return [
    `🔥 <b>Gerçek Arbitraj Fırsatı</b>`,
    `Tahmini net kâr: %${margin}`,
    `Medyan karşılaştırma: ${median} EUR (${assessment.comparableCount} ilan)`,
    `AI güveni: %${confidence}`,
    `Değerlendirme: ${escapeHtml(assessment.reason)}`,
  ].join("\n");
}

function listingSource(listing: Listing) {
  try {
    return new URL(listing.listing_url).hostname.replace(/^www\./, "");
  } catch {
    return listing.source_key;
  }
}

function conditionLabel(condition: VehicleCondition, locale: "tr" | "fa") {
  const labels = locale === "fa"
    ? { new: "صفر کیلومتر", used_excellent: "دست‌دوم ـ بسیار خوب", used_good: "دست‌دوم ـ خوب", used_fair: "دست‌دوم ـ معمولی", damaged: "تصادفی / آسیب‌دیده" }
    : { new: "Sıfır", used_excellent: "İkinci el - çok iyi", used_good: "İkinci el - iyi", used_fair: "İkinci el - normal", damaged: "Kazalı / hasarlı" };
  return labels[condition];
}

function labelTextFa(label: DigestAlert["opportunity_label"]) {
  if (label === "hot") return "فرصت داغ";
  if (label === "good") return "فرصت مناسب";
  if (label === "watch") return "نیازمند بررسی";
  return "اطلاعات";
}

function translateReasonFa(reason: string) {
  return reason
    .replace(/^Marka uyumu:/, "تطابق برند:")
    .replace(/^Model uyumu:/, "تطابق مدل:")
    .replace(/^Ülke uyumu:/, "تطابق کشور:")
    .replace(/^Şehir uyumu:/, "تطابق شهر:")
    .replace(/^Araç tipi uyumu:/, "تطابق نوع خودرو:")
    .replace(/^Yıl beklentiyi karşılıyor:/, "سال ساخت مطابق خواسته:")
    .replace(/^Km beklentiyi karşılıyor:/, "کارکرد مطابق خواسته:")
    .replace(/^Fiyat hedefin %10\+ altında:/, "قیمت بیش از ۱۰٪ پایین‌تر از هدف:")
    .replace(/^Fiyat hedef içinde:/, "قیمت در محدوده هدف:")
    .replace("Fiyat hedefe yakın", "قیمت نزدیک به هدف است")
    .replace("Fiyat hedefin üzerinde", "قیمت بالاتر از هدف است")
    .replace(/^Keyword uyumu:/, "تطابق کلیدواژه:")
    .replace("Yeni yakalandı", "به‌تازگی پیدا شده است")
    .replace("Genel web araması sonucu, manuel kontrol önerilir", "نتیجه جست‌وجوی عمومی وب است؛ بررسی دستی توصیه می‌شود");
}

function formatHealthWarning(issues: ScannerHealthIssue[], locale: "tr" | "fa") {
  if (locale === "tr") {
    return ["⚠️ Tarayıcı sağlık uyarısı", "", ...issues.map((issue) => `- ${issue.sourceName}: ${issue.detail}`)].join("\n");
  }
  return [
    "⚠️ هشدار سلامت جست‌وجوگر",
    "",
    ...issues.map((issue) => `- ${issue.sourceName}: ${issue.kind === "never_ran" ? "هنوز اجرا نشده است" : issue.kind === "stale" ? "جست‌وجو با تأخیر انجام شده است" : "آخرین اجرا ناموفق بود"}`),
  ].join("\n");
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

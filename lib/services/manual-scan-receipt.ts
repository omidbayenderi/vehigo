import type { SupabaseClient } from "@supabase/supabase-js";
import type { ScannerRunSummary } from "@/lib/scanner/runner";
import type { Database } from "@/lib/supabase/types";
import { sendTelegramMessage } from "@/lib/services/notifications";

type Client = SupabaseClient<Database>;

export async function sendManualScanReceipt(
  supabase: Client,
  userId: string,
  summary: ScannerRunSummary,
) {
  const { data: profile, error } = await supabase
    .from("users_profile")
    .select("telegram_chat_id,telegram_verified_at,locale")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!profile?.telegram_chat_id || !profile.telegram_verified_at) {
    return { sent: false as const, reason: "not_linked" as const };
  }

  const message = profile.locale === "fa"
    ? [
      "<b>جست‌وجوی دستی Vehigo تکمیل شد</b>",
      `عامل‌های بازار فعال: ${summary.siteAgents.completed}`,
      `آگهی‌های دریافت‌شده: ${summary.fetched}`,
      `تطابق جدید: ${summary.alertsCreated}`,
      summary.alertsCreated === 0
        ? "آگهی جدیدی مطابق فیلترهای شما یافت نشد."
        : `اعلان‌های تطابق: ${summary.alertsSent} موفق، ${summary.alertsFailed} ناموفق.`,
    ].join("\n")
    : [
      "<b>Vehigo manuel tarama tamamlandı</b>",
      `Çalışan pazar ajanı: ${summary.siteAgents.completed}`,
      `Çekilen ilan: ${summary.fetched}`,
      `Yeni eşleşme: ${summary.alertsCreated}`,
      summary.alertsCreated === 0
        ? "Filtrelerinize uyan yeni ilan bulunmadı."
        : `Eşleşme bildirimleri: ${summary.alertsSent} başarılı, ${summary.alertsFailed} başarısız.`,
    ].join("\n");
  const delivery = await sendTelegramMessage(profile.telegram_chat_id, message);
  return delivery.ok
    ? { sent: true as const }
    : { sent: false as const, reason: "delivery_failed" as const, error: delivery.error };
}

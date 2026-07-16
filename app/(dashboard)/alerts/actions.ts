"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/lib/supabase/types";
import { createWatchlist, deleteWatchlist, matchStoredListingsForWatchlist, replaceWatchlist, updateWatchlist } from "@/lib/services/market-alerts";
import { marketListingToVehicleInsert, scoreLeadForListing } from "@/lib/services/opportunity-flow";
import { logAudit } from "@/lib/services/audit";
import { listingDecisionSchema, telegramSettingsSchema } from "@/lib/validation/schemas";
import { formDataToObject } from "@/lib/utils";
import { runScannerOnce } from "@/lib/scanner/runner";
import { sendOpportunityDigest } from "@/lib/services/opportunity-digest";
import { analyzeMarketListing } from "@/lib/services/market-intelligence";
import { runAiMarketReview } from "@/lib/services/ai-evaluation-ledger";
import { sendManualScanReceipt } from "@/lib/services/manual-scan-receipt";

export type FormState = { error?: string; ok?: string };
type MarketListing = Database["public"]["Tables"]["market_listings"]["Row"];
type AlertWithListing = Database["public"]["Tables"]["listing_alerts"]["Row"] & {
  market_listings: MarketListing | null;
};

export async function updateTelegramSettingsAction(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  void _prevState;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  try {
    const parsed = telegramSettingsSchema.parse(formDataToObject(formData));
    const nextUsername = parsed.telegram_username?.toLowerCase() ?? null;

    const { data: current, error: currentError } = await supabase
      .from("users_profile")
      .select("telegram_username")
      .eq("id", user.id)
      .single();
    if (currentError) throw new Error(currentError.message);

    const usernameChanged = current.telegram_username !== nextUsername;

    const { error } = await supabase
      .from("users_profile")
      .update(
        usernameChanged
          ? { telegram_username: nextUsername, telegram_chat_id: null, telegram_verified_at: null }
          : { telegram_username: nextUsername },
      )
      .eq("id", user.id);
    if (error) throw new Error(error.message);

    await logAudit(supabase, user.id, "update_telegram_settings", "user_profile", user.id);
    revalidatePath("/alerts");
    return {
      ok: usernameChanged
        ? "Telegram kullanıcı adı kaydedildi. Botu Telegram'da başlatarak doğrulayın."
        : "Telegram kullanıcı adı zaten kayıtlı, bağlantı korundu.",
    };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Bilinmeyen hata" };
  }
}

export async function createWatchlistAction(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  try {
    const watchlist = await createWatchlist(supabase, formDataToObject(formData), user.id);
    const existingMatches = await matchStoredListingsForWatchlist(createAdminClient(), watchlist.id);
    await logAudit(supabase, user.id, "create", "watchlist", watchlist.id);
    revalidatePath("/alerts");
    return { ok: existingMatches > 0 ? `Alarm oluşturuldu; mevcut indekste ${existingMatches} uygun ilan bulundu. Telegram bağlantınız hazırsa bir sonraki teslimatta gönderilecek.` : "Alarm oluşturuldu; mevcut indeks tarandı ve yeni arama emri sıraya alındı." };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Bilinmeyen hata" };
  }
}

export async function toggleWatchlistAction(id: string, active: boolean) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  await updateWatchlist(supabase, id, { active });
  await logAudit(supabase, user.id, active ? "enable" : "disable", "watchlist", id);
  revalidatePath("/alerts");
}

export async function editWatchlistAction(
  id: string,
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  try {
    const watchlist = await replaceWatchlist(supabase, id, formDataToObject(formData));
    const existingMatches = await matchStoredListingsForWatchlist(createAdminClient(), watchlist.id);
    await logAudit(supabase, user.id, "update", "watchlist", watchlist.id);
    revalidatePath("/alerts");
    return { ok: existingMatches > 0 ? `Filtre güncellendi; indeksten ${existingMatches} yeni eşleşme eklendi.` : "Filtre güncellendi ve mevcut indeks yeniden kontrol edildi." };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Filtre güncellenemedi" };
  }
}

export async function deleteWatchlistAction(id: string): Promise<FormState> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  try {
    await deleteWatchlist(supabase, id);
    await logAudit(supabase, user.id, "delete", "watchlist", id);
    revalidatePath("/alerts");
    return { ok: "Filtre silindi." };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Filtre silinemedi" };
  }
}

export async function runScannerNowAction(): Promise<FormState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  try {
    const { data: isPlatformAdmin, error: adminError } = await supabase.rpc("is_platform_admin", {});
    if (adminError) throw new Error(adminError.message);
    if (!isPlatformAdmin) {
      return { error: "Manuel pazar taraması yalnızca platform yöneticisi tarafından çalıştırılabilir." };
    }

    const admin = createAdminClient();
    const summary = await runScannerOnce(admin, { force: true, siteAgentScope: "all" });
    const receipt = await sendManualScanReceipt(admin, user.id, summary);
    await logAudit(supabase, user.id, "manual_run", "scanner", null, { command: "run" });
    revalidatePath("/alerts");
    return {
      ok: `Tarama tamamlandı: ${summary.scannedSources} doğrudan kaynak, ${summary.siteAgents.completed} bağımsız pazar ajanı çalıştı; ${summary.fetched} ilan çekildi, ${summary.inserted} yeni ilan, ${summary.alertsCreated} yeni eşleşme oluşturuldu. ${summary.alertsCreated === 0 ? "Filtrelere uyan ilan olmadığı için fırsat bildirimi oluşmadı." : "Geçici arama eşleşmeleri aynı turda Telegram'a iletildi."} Manuel tarama makbuzu ${receipt.sent ? "Telegram'a iletildi" : receipt.reason === "not_linked" ? "için Telegram bağlantısı bulunamadı" : "Telegram'a iletilemedi"}. ${summary.delisted} ilan satılmış/kaldırılmış olarak işaretlendi.${summary.failed.length > 0 ? ` Hatalı: ${summary.failed.map((f) => f.sourceKey).join(", ")}.` : ""}`,
    };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Bilinmeyen hata" };
  }
}

export async function sendDigestNowAction(): Promise<FormState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  try {
    const admin = createAdminClient();
    const result = await sendOpportunityDigest(admin, { hours: 12, userId: user.id });
    await logAudit(supabase, user.id, "manual_run", "digest", null, { command: "send" });
    revalidatePath("/alerts");
    return {
      ok:
        result.users === 0
          ? "Gönderilecek yeni eşleşme yok. Tarama çalışıyor; alarm filtrelerinize uyan yeni ilan bulunduğunda Telegram özeti hazırlanır."
          : `Özet tamamlandı: ${result.sent} Telegram mesajı iletildi, ${result.skipped} atlandı, ${result.failed} başarısız.${result.healthIssues > 0 ? ` ⚠️ ${result.healthIssues} otomatik kaynakta sağlık sorunu tespit edildi ve bildirildi.` : ""}`,
    };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Bilinmeyen hata" };
  }
}

export async function updateOpportunityDecisionAction(
  alertId: string,
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  try {
    const parsed = listingDecisionSchema.parse(formDataToObject(formData));
    const decisionReason = parsed.decision_status === "new" ? null : (parsed.decision_reason ?? null);
    const { data, error } = await supabase
      .from("listing_alerts")
      .update({
        decision_status: parsed.decision_status,
        decision_reason: decisionReason,
        decided_at: parsed.decision_status === "new" ? null : new Date().toISOString(),
      })
      .eq("id", alertId)
      .eq("user_id", user.id)
      .select("id")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) return { error: "İlan kararı bulunamadı veya bu kullanıcıya ait değil." };

    await logAudit(supabase, user.id, "opportunity_decision", "listing_alert", alertId, {
      status: parsed.decision_status,
      reason: decisionReason,
    });
    revalidatePath("/alerts");
    revalidatePath("/dashboard");
    return { ok: "Karar kaydedildi." };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Karar kaydedilemedi" };
  }
}

export async function startOfferFromAlertAction(alertId: string, leadId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: alert, error: alertError } = await supabase
    .from("listing_alerts")
    .select("*, market_listings(*)")
    .eq("id", alertId)
    .eq("user_id", user.id)
    .single();
  if (alertError) throw new Error(alertError.message);
  const listing = (alert as unknown as AlertWithListing).market_listings;
  if (!listing) throw new Error("İlan bulunamadı");

  const { data: lead, error: leadError } = await supabase
    .from("leads")
    .select("*")
    .eq("id", leadId)
    .eq("created_by", user.id)
    .single();
  if (leadError) throw new Error(leadError.message);

  const { data: existingVehicle, error: existingVehicleError } = await supabase
    .from("vehicles")
    .select("id")
    .eq("listing_url", listing.listing_url)
    .maybeSingle();
  if (existingVehicleError) throw new Error(existingVehicleError.message);

  const vehicleId =
    existingVehicle?.id ?? (await createVehicleFromListing(supabase, listing, user.id));
  const suggestion = scoreLeadForListing(lead, listing);

  const { error: matchError } = await supabase
    .from("matches")
    .upsert(
      {
        lead_id: leadId,
        vehicle_id: vehicleId,
        match_score: suggestion.score,
        match_reasoning: suggestion.reasons.map((reason) => ({
          criterion: reason,
          matched: true,
          detail: reason,
        })),
      },
      { onConflict: "lead_id,vehicle_id" },
    );
  if (matchError) throw new Error(matchError.message);

  await logAudit(supabase, user.id, "opportunity_offer_started", "listing_alert", alertId, {
    leadId,
    vehicleId,
    score: suggestion.score,
  });

  revalidatePath("/alerts");
  revalidatePath("/vehicles");
  redirect(`/offers/new?lead_id=${leadId}&vehicle_id=${vehicleId}`);
}

export async function analyzeListingIntelligenceAction(
  listingId: string,
  includeAi: boolean,
  _prevState: FormState,
): Promise<FormState> {
  void _prevState;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  try {
    const admin = createAdminClient();
    const snapshot = await analyzeMarketListing(admin, listingId);
    let message = `Piyasa analizi hazır: ${snapshot.comparable_count} uygun ilan, örneklem ${sampleQualityLabel(snapshot.sample_quality)}.`;
    if (includeAi) {
      const evaluation = await runAiMarketReview(admin, user.id, snapshot);
      message += evaluation.status === "completed"
        ? " AI kanıt incelemesi kaydedildi ve insan onayına bırakıldı."
        : ` AI incelemesi ${evaluation.status === "skipped" ? "atlanarak" : "hata kaydıyla"} deftere işlendi.`;
    }
    await logAudit(supabase, user.id, includeAi ? "market_intelligence_with_ai" : "market_intelligence", "market_listing", listingId, { snapshot_id: snapshot.id, evidence_hash: snapshot.evidence_hash });
    revalidatePath("/alerts");
    return { ok: message };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Piyasa analizi oluşturulamadı." };
  }
}

export async function deleteAlertsAction(alertIds: string[]): Promise<FormState> {
  if (alertIds.length === 0) return { error: "Silinecek ilan seçilmedi." };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  try {
    const { data, error } = await supabase
      .from("listing_alerts")
      .delete()
      .eq("user_id", user.id)
      .in("id", alertIds)
      .select("id");
    if (error) throw new Error(error.message);

    await logAudit(supabase, user.id, "delete", "listing_alert", null, { alertIds, count: data?.length ?? 0 });
    revalidatePath("/alerts");
    revalidatePath("/dashboard");
    return { ok: `${data?.length ?? 0} ilan fırsat akışından kaldırıldı.` };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "İlanlar silinemedi" };
  }
}

export async function clearAllAlertsAction(): Promise<FormState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  try {
    const { data, error } = await supabase
      .from("listing_alerts")
      .delete()
      .eq("user_id", user.id)
      .select("id");
    if (error) throw new Error(error.message);

    await logAudit(supabase, user.id, "delete", "listing_alert", null, { scope: "all", count: data?.length ?? 0 });
    revalidatePath("/alerts");
    revalidatePath("/dashboard");
    return { ok: `Fırsat akışı temizlendi (${data?.length ?? 0} ilan).` };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Fırsat akışı temizlenemedi" };
  }
}

function sampleQualityLabel(value: string) {
  if (value === "high") return "yüksek";
  if (value === "medium") return "orta";
  if (value === "low") return "düşük";
  return "yetersiz";
}

async function createVehicleFromListing(
  supabase: Awaited<ReturnType<typeof createClient>>,
  listing: MarketListing,
  userId: string,
) {
  const { data: vehicle, error } = await supabase
    .from("vehicles")
    .insert(marketListingToVehicleInsert(listing, userId))
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return vehicle.id;
}

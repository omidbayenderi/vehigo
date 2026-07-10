"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/lib/supabase/types";
import { createWatchlist, updateWatchlist } from "@/lib/services/market-alerts";
import { marketListingToVehicleInsert, scoreLeadForListing } from "@/lib/services/opportunity-flow";
import { logAudit } from "@/lib/services/audit";
import { telegramSettingsSchema } from "@/lib/validation/schemas";
import { formDataToObject } from "@/lib/utils";
import { runScannerOnce } from "@/lib/scanner/runner";
import { sendOpportunityDigest } from "@/lib/services/opportunity-digest";

export type FormState = { error?: string; ok?: string };
type MarketListing = Database["public"]["Tables"]["market_listings"]["Row"];
type AlertWithListing = Database["public"]["Tables"]["listing_alerts"]["Row"] & {
  market_listings: MarketListing | null;
};

export async function updateTelegramSettingsAction(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  try {
    const parsed = telegramSettingsSchema.parse(formDataToObject(formData));
    const { error } = await supabase
      .from("users_profile")
      .update({
        telegram_username: parsed.telegram_username?.toLowerCase() ?? null,
        telegram_chat_id: null,
        telegram_verified_at: null,
      })
      .eq("id", user.id);
    if (error) throw new Error(error.message);

    await logAudit(supabase, user.id, "update_telegram_settings", "user_profile", user.id);
    revalidatePath("/alerts");
    return { ok: "Telegram kullanıcı adı kaydedildi. Botu Telegram'da başlatarak doğrulayın." };
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
    await logAudit(supabase, user.id, "create", "watchlist", watchlist.id);
    revalidatePath("/alerts");
    return { ok: "Alarm kuralı oluşturuldu." };
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

export async function runScannerNowAction(): Promise<FormState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  try {
    const admin = createAdminClient();
    const summary = await runScannerOnce(admin, { force: true });
    await logAudit(supabase, user.id, "manual_run", "scanner", "run");
    revalidatePath("/alerts");
    return {
      ok: `Tarama tamamlandı: ${summary.scannedSources} kaynak, ${summary.fetched} ilan çekildi, ${summary.inserted} yeni, ${summary.alertsSent} bildirim gönderildi.${summary.failed.length > 0 ? ` Hatalı: ${summary.failed.map((f) => f.sourceKey).join(", ")}.` : ""}`,
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
    const result = await sendOpportunityDigest(admin, { hours: 24 });
    await logAudit(supabase, user.id, "manual_run", "digest", "send");
    revalidatePath("/alerts");
    return {
      ok: `Özet gönderildi: ${result.sent} kullanıcıya iletildi, ${result.skipped} atlandı, ${result.failed} başarısız.${result.healthIssues > 0 ? ` ⚠️ ${result.healthIssues} kaynakta sağlık sorunu tespit edildi ve bildirildi.` : ""}`,
    };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Bilinmeyen hata" };
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

"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createWatchlist, updateWatchlist } from "@/lib/services/market-alerts";
import { logAudit } from "@/lib/services/audit";
import { telegramSettingsSchema } from "@/lib/validation/schemas";
import { formDataToObject } from "@/lib/utils";

export type FormState = { error?: string; ok?: string };

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

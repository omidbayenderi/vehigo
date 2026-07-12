import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

type Client = SupabaseClient<Database>;

export type TelegramSendResult = {
  ok: boolean;
  error?: string;
};

export function normalizeTelegramUsername(username: string) {
  return username.trim().replace(/^@/, "").toLowerCase();
}

export async function sendTelegramMessage(chatId: string, text: string): Promise<TelegramSendResult> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return { ok: false, error: "TELEGRAM_BOT_TOKEN tanımlı değil" };

  const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: "HTML",
      disable_web_page_preview: false,
    }),
    signal: AbortSignal.timeout(12_000),
  });

  const payload = (await response.json().catch(() => null)) as { ok?: boolean; description?: string } | null;
  if (!response.ok || !payload?.ok) {
    return { ok: false, error: payload?.description ?? `Telegram HTTP ${response.status}` };
  }

  return { ok: true };
}

export async function linkTelegramChatByUsername(
  supabase: Client,
  username: string,
  chatId: string,
) {
  const normalized = normalizeTelegramUsername(username);
  const { data: profile, error: fetchError } = await supabase
    .from("users_profile")
    .select("id")
    .ilike("telegram_username", normalized)
    .maybeSingle();

  if (fetchError) throw new Error(fetchError.message);
  if (!profile) return { linked: false as const };

  const { error } = await supabase
    .from("users_profile")
    .update({
      telegram_username: normalized,
      telegram_chat_id: chatId,
      telegram_verified_at: new Date().toISOString(),
    })
    .eq("id", profile.id);
  if (error) throw new Error(error.message);

  return { linked: true as const, userId: profile.id };
}

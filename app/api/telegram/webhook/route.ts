import { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { linkTelegramChatByUsername, sendTelegramMessage } from "@/lib/services/notifications";

type TelegramUpdate = {
  message?: {
    text?: string;
    chat?: { id?: number | string };
    from?: { username?: string };
  };
};

export async function POST(request: NextRequest) {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (secret && request.headers.get("x-telegram-bot-api-secret-token") !== secret) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const update = (await request.json()) as TelegramUpdate;
  const chatId = update.message?.chat?.id;
  const username = update.message?.from?.username;
  const text = update.message?.text ?? "";

  if (!chatId || !username) {
    return Response.json({ ok: true, ignored: true });
  }

  const supabase = createAdminClient();
  const linked = await linkTelegramChatByUsername(supabase, username, String(chatId));

  if (linked.linked) {
    await sendTelegramMessage(
      String(chatId),
      "Vehigo ilan alarmları bu Telegram hesabına bağlandı. Eşleşen yeni ilanlar burada görünecek.",
    );
  } else if (text.startsWith("/start")) {
    await sendTelegramMessage(
      String(chatId),
      "Vehigo'da Telegram kullanıcı adınızı kaydedin, sonra bu botu tekrar başlatın. Kullanıcı adınız eşleşince bağlantı doğrulanır.",
    );
  }

  return Response.json({ ok: true, linked: linked.linked });
}

"use client";

import { useActionState } from "react";
import { Send } from "lucide-react";
import { updateTelegramSettingsAction, type FormState } from "./actions";

const initialState: FormState = {};
const BOT_LINK = "https://t.me/vehigobot";

export default function TelegramSettingsForm({
  username,
  verified,
}: {
  username: string | null;
  verified: boolean;
}) {
  const [state, formAction, pending] = useActionState(updateTelegramSettingsAction, initialState);

  return (
    <form action={formAction} className="rounded-lg border border-line-soft bg-surface p-5 shadow-[0_1px_2px_rgba(23,24,43,0.04)]">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-sm font-medium text-ink">Telegram bağlantısı</h2>
          <p className="mt-1 text-sm text-ink-faint">
            1) Kendi Telegram kullanıcı adını (Telegram &gt; Ayarlar &gt; Kullanıcı adı) aşağıya kaydet. 2) Ardından
            botu başlat — bağlantı ancak sen botla konuştuğunda doğrulanır.
          </p>
        </div>
        <span
          className={`shrink-0 rounded-full px-2 py-1 text-xs ${
            verified ? "bg-success-wash text-success" : "bg-warning-wash text-warning"
          }`}
        >
          {verified ? "Doğrulandı" : "Doğrulanmadı"}
        </span>
      </div>

      <div className="flex gap-2">
        <input
          key={username ?? "empty"}
          type="text"
          name="telegram_username"
          defaultValue={username ? `@${username}` : ""}
          placeholder="@kullaniciadi"
          className="flex-1 rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15"
        />
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-ink disabled:opacity-50"
        >
          {pending ? "Kaydediliyor..." : "Kaydet"}
        </button>
      </div>

      {state.error ? <p className="mt-2 text-sm text-danger">{state.error}</p> : null}
      {state.ok ? <p className="mt-2 text-sm text-success">{state.ok}</p> : null}

      {!verified ? (
        <a
          href={BOT_LINK}
          target="_blank"
          rel="noreferrer"
          className="mt-3 flex items-center justify-center gap-2 rounded-md border border-line bg-paper px-3 py-2 text-sm font-medium text-ink-soft transition-colors hover:border-brand hover:text-brand"
        >
          <Send className="h-4 w-4" strokeWidth={1.75} />
          2. adım: Telegram&apos;da botu aç ve /start yaz
        </a>
      ) : null}
    </form>
  );
}

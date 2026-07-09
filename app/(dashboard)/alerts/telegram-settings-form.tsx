"use client";

import { useActionState } from "react";
import { updateTelegramSettingsAction, type FormState } from "./actions";

const initialState: FormState = {};

export default function TelegramSettingsForm({
  username,
  verified,
}: {
  username: string | null;
  verified: boolean;
}) {
  const [state, formAction, pending] = useActionState(updateTelegramSettingsAction, initialState);

  return (
    <form action={formAction} className="rounded-lg border border-zinc-200 bg-white p-5">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-sm font-medium text-zinc-900">Telegram bağlantısı</h2>
          <p className="mt-1 text-sm text-zinc-500">
            Tek bot kullanılır. Kullanıcı adı kaydedildikten sonra kullanıcı botu başlatınca chat_id doğrulanır.
          </p>
        </div>
        <span
          className={`rounded-full px-2 py-1 text-xs ${
            verified ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"
          }`}
        >
          {verified ? "Doğrulandı" : "Doğrulanmadı"}
        </span>
      </div>

      <div className="flex gap-2">
        <input
          type="text"
          name="telegram_username"
          defaultValue={username ? `@${username}` : ""}
          placeholder="@kullaniciadi"
          className="flex-1 rounded-md border border-zinc-300 px-3 py-2 text-sm"
        />
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50"
        >
          {pending ? "Kaydediliyor..." : "Kaydet"}
        </button>
      </div>

      {state.error ? <p className="mt-2 text-sm text-red-600">{state.error}</p> : null}
      {state.ok ? <p className="mt-2 text-sm text-green-700">{state.ok}</p> : null}
    </form>
  );
}

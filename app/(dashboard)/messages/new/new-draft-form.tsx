"use client";

import { useActionState, useState } from "react";
import { createMessageDraftAction, type FormState } from "../actions";

const initialState: FormState = {};

export default function NewDraftForm({
  leadId,
  offerId,
  defaultText,
}: {
  leadId: string;
  offerId?: string;
  defaultText: string;
}) {
  const [state, formAction, pending] = useActionState(createMessageDraftAction, initialState);
  const [text, setText] = useState(defaultText);

  return (
    <form action={formAction} className="space-y-4 rounded-lg border border-zinc-200 bg-white p-6">
      <input type="hidden" name="lead_id" value={leadId} />
      {offerId ? <input type="hidden" name="offer_id" value={offerId} /> : null}

      <div>
        <label className="mb-1 block text-sm font-medium text-zinc-700">Kanal</label>
        <select name="channel" required className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm">
          <option value="whatsapp">WhatsApp</option>
          <option value="telegram">Telegram</option>
          <option value="instagram">Instagram</option>
        </select>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-zinc-700">Mesaj metni (Farsça)</label>
        <textarea
          name="draft_text"
          rows={8}
          dir="rtl"
          value={text}
          onChange={(e) => setText(e.target.value)}
          required
          className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
        />
      </div>

      {state.error ? <p className="text-sm text-red-600">{state.error}</p> : null}

      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50"
      >
        {pending ? "Kaydediliyor..." : "Taslağı kaydet"}
      </button>
    </form>
  );
}

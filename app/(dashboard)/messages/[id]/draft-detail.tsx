"use client";

import { useState, useTransition } from "react";
import type { Database } from "@/lib/supabase/types";
import {
  saveDraftTextAction,
  approveDraftAction,
  markDraftSentAction,
  discardDraftAction,
} from "../actions";

type Draft = Database["public"]["Tables"]["message_drafts"]["Row"];

const statusLabel: Record<string, string> = {
  draft: "Taslak",
  approved: "Onaylandı",
  sent: "Gönderildi",
  discarded: "İptal Edildi",
};

export default function DraftDetail({ draft }: { draft: Draft }) {
  const [text, setText] = useState(draft.draft_text ?? "");
  const [copied, setCopied] = useState(false);
  const [pending, startTransition] = useTransition();
  const editable = draft.status === "draft";

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-6">
      <div className="mb-4 flex items-center justify-between">
        <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-medium text-zinc-700">
          {statusLabel[draft.status]}
        </span>
        <span className="text-xs text-zinc-500">{draft.channel}</span>
      </div>

      <textarea
        dir="rtl"
        rows={8}
        value={text}
        disabled={!editable || pending}
        onChange={(e) => setText(e.target.value)}
        className="mb-2 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm disabled:bg-zinc-50"
      />

      {editable ? (
        <button
          type="button"
          disabled={pending}
          onClick={() => startTransition(() => saveDraftTextAction(draft.id, text))}
          className="mb-4 rounded-md border border-zinc-300 px-3 py-2 text-sm hover:bg-zinc-100 disabled:opacity-50"
        >
          Değişikliği kaydet
        </button>
      ) : null}

      <div className="flex flex-wrap gap-2 border-t border-zinc-100 pt-4">
        <button
          type="button"
          onClick={() => {
            navigator.clipboard.writeText(text);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          }}
          className="rounded-md border border-zinc-300 px-3 py-2 text-sm hover:bg-zinc-100"
        >
          {copied ? "Kopyalandı ✓" : "Metni kopyala"}
        </button>

        {draft.status === "draft" ? (
          <button
            type="button"
            disabled={pending}
            onClick={() => startTransition(() => approveDraftAction(draft.id))}
            className="rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50"
          >
            Onayla
          </button>
        ) : null}

        {draft.status === "approved" ? (
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              if (
                !confirm(
                  "Bu mesajı WhatsApp/Telegram üzerinden kendi hesabınızdan manuel olarak gönderdiniz mi?",
                )
              )
                return;
              startTransition(() => markDraftSentAction(draft.id));
            }}
            className="rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50"
          >
            Gönderildi olarak işaretle
          </button>
        ) : null}

        {draft.status !== "sent" && draft.status !== "discarded" ? (
          <button
            type="button"
            disabled={pending}
            onClick={() => startTransition(() => discardDraftAction(draft.id))}
            className="rounded-md border border-red-200 px-3 py-2 text-sm text-red-600 hover:bg-red-50 disabled:opacity-50"
          >
            İptal et
          </button>
        ) : null}
      </div>

      <p className="mt-4 text-xs text-zinc-400">
        Bu sistem hiçbir mesajı otomatik göndermez. Metni kopyalayıp kendi WhatsApp/Telegram hesabınızdan
        elle göndermelisiniz.
      </p>
    </div>
  );
}

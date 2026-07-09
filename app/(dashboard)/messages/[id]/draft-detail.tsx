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
    <div className="rounded-lg border border-line-soft bg-white p-6">
      <div className="mb-4 flex items-center justify-between">
        <span className="rounded-full bg-surface-sunken px-3 py-1 text-xs font-medium text-ink-soft">
          {statusLabel[draft.status]}
        </span>
        <span className="text-xs text-ink-faint">{draft.channel}</span>
      </div>

      <textarea
        dir="rtl"
        rows={8}
        value={text}
        disabled={!editable || pending}
        onChange={(e) => setText(e.target.value)}
        className="mb-2 w-full rounded-md border border-line px-3 py-2 text-sm disabled:bg-paper"
      />

      {editable ? (
        <button
          type="button"
          disabled={pending}
          onClick={() => startTransition(() => saveDraftTextAction(draft.id, text))}
          className="mb-4 rounded-md border border-line px-3 py-2 text-sm hover:bg-surface-sunken disabled:opacity-50"
        >
          Değişikliği kaydet
        </button>
      ) : null}

      <div className="flex flex-wrap gap-2 border-t border-line-soft pt-4">
        <button
          type="button"
          onClick={() => {
            navigator.clipboard.writeText(text);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          }}
          className="rounded-md border border-line px-3 py-2 text-sm hover:bg-surface-sunken"
        >
          {copied ? "Kopyalandı ✓" : "Metni kopyala"}
        </button>

        {draft.status === "draft" ? (
          <button
            type="button"
            disabled={pending}
            onClick={() => startTransition(() => approveDraftAction(draft.id))}
            className="rounded-md bg-brand px-3 py-2 text-sm font-medium text-white hover:bg-brand-ink disabled:opacity-50"
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
            className="rounded-md bg-brand px-3 py-2 text-sm font-medium text-white hover:bg-brand-ink disabled:opacity-50"
          >
            Gönderildi olarak işaretle
          </button>
        ) : null}

        {draft.status !== "sent" && draft.status !== "discarded" ? (
          <button
            type="button"
            disabled={pending}
            onClick={() => startTransition(() => discardDraftAction(draft.id))}
            className="rounded-md border border-danger px-3 py-2 text-sm text-danger hover:bg-danger-wash disabled:opacity-50"
          >
            İptal et
          </button>
        ) : null}
      </div>

      <p className="mt-4 text-xs text-ink-faint">
        Bu sistem hiçbir mesajı otomatik göndermez. Metni kopyalayıp kendi WhatsApp/Telegram hesabınızdan
        elle göndermelisiniz.
      </p>
    </div>
  );
}

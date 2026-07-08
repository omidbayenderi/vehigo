"use client";

import { useTransition } from "react";
import { confirmOfferSentAction } from "../actions";

export default function ConfirmSentButton({ offerId, disabled }: { offerId: string; disabled: boolean }) {
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={disabled || pending}
      onClick={() => {
        if (!confirm("PDF'i müşteriyle manuel olarak paylaştınız mı? Onaylarsanız durum güncellenecek.")) return;
        startTransition(() => {
          confirmOfferSentAction(offerId);
        });
      }}
      className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {pending ? "İşaretleniyor..." : "Gönderildi olarak işaretle"}
    </button>
  );
}

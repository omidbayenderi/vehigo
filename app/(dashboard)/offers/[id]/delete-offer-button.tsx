"use client";

import { useTransition } from "react";
import { deleteOfferAction } from "../actions";

export default function DeleteOfferButton({ offerId }: { offerId: string }) {
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        if (!confirm("Bu teklifi silmek istediğinizden emin misiniz? Bu işlem geri alınamaz.")) return;
        startTransition(() => {
          deleteOfferAction(offerId);
        });
      }}
      className="rounded-md border border-danger px-4 py-2 text-sm font-medium text-danger hover:bg-danger-wash disabled:cursor-not-allowed disabled:opacity-50"
    >
      {pending ? "Siliniyor..." : "Teklifi sil"}
    </button>
  );
}

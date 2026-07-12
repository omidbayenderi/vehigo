"use client";

import { useActionState } from "react";
import { closeOfferOutcomeAction, type FormState } from "../actions";
import { cardClass } from "@/lib/ui";
import type { Database } from "@/lib/supabase/types";

type Offer = Database["public"]["Tables"]["offers"]["Row"];

const initialState: FormState = {};

export default function CloseOutcomeForm({ offer }: { offer: Offer }) {
  const action = closeOfferOutcomeAction.bind(null, offer.id);
  const [state, formAction, pending] = useActionState(action, initialState);

  const expectedProfit = offer.commission_amount_calculated ?? 0;
  const realizedProfit =
    offer.actual_revenue !== null && offer.actual_total_cost !== null
      ? offer.actual_revenue - offer.actual_total_cost
      : null;

  return (
    <div className={`${cardClass} p-6`}>
      <h2 className="mb-1 text-sm font-medium text-ink">İşlem sonucu</h2>
      <p className="mb-4 text-xs text-ink-faint">
        Beklenen kâr: {expectedProfit.toLocaleString("tr-TR")} {offer.currency}
        {realizedProfit !== null
          ? ` · Gerçekleşen kâr: ${realizedProfit.toLocaleString("tr-TR")} ${offer.currency}`
          : null}
      </p>

      <form action={formAction} className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-ink-soft" htmlFor="closed_outcome">
              Sonuç
            </label>
            <select
              id="closed_outcome"
              name="closed_outcome"
              defaultValue={offer.closed_outcome ?? ""}
              className="w-full rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15"
            >
              <option value="" disabled>
                Seçin
              </option>
              <option value="won">Kazanıldı</option>
              <option value="lost">Kaybedildi</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-ink-soft" htmlFor="actual_revenue">
              Gerçek gelir
            </label>
            <input
              id="actual_revenue"
              name="actual_revenue"
              type="number"
              step="0.01"
              defaultValue={offer.actual_revenue ?? ""}
              className="w-full rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-ink-soft" htmlFor="actual_total_cost">
              Gerçek toplam maliyet
            </label>
            <input
              id="actual_total_cost"
              name="actual_total_cost"
              type="number"
              step="0.01"
              defaultValue={offer.actual_total_cost ?? ""}
              className="w-full rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15"
            />
          </div>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-ink-soft" htmlFor="closed_notes">
            Not
          </label>
          <textarea
            id="closed_notes"
            name="closed_notes"
            rows={2}
            defaultValue={offer.closed_notes ?? ""}
            className="w-full rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15"
          />
        </div>

        {state.error ? <p className="text-sm text-danger">{state.error}</p> : null}

        <button
          type="submit"
          disabled={pending}
          className="rounded-md border border-line px-3 py-2 text-sm text-ink-soft transition-colors hover:bg-surface-sunken hover:text-ink disabled:opacity-50"
        >
          {pending ? "Kaydediliyor..." : "Sonucu kaydet"}
        </button>
      </form>
    </div>
  );
}

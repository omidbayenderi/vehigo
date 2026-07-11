"use client";

import { useActionState } from "react";
import type { ListingDecisionReason, ListingDecisionStatus } from "@/lib/supabase/types";
import { updateOpportunityDecisionAction, type FormState } from "./actions";

const initialState: FormState = {};

const reasons: Array<{ value: ListingDecisionReason; label: string }> = [
  { value: "good_price", label: "Fiyat iyi" },
  { value: "right_vehicle", label: "Aranan araç" },
  { value: "trusted_seller", label: "Satıcı güvenilir" },
  { value: "too_expensive", label: "Çok pahalı" },
  { value: "wrong_vehicle", label: "Yanlış araç" },
  { value: "bad_condition", label: "Durumu kötü" },
  { value: "sold", label: "Satılmış" },
  { value: "duplicate", label: "Tekrar ilan" },
  { value: "other", label: "Diğer" },
];

export default function OpportunityDecisionForm({
  alertId,
  status,
  reason,
}: {
  alertId: string;
  status: ListingDecisionStatus;
  reason: ListingDecisionReason | null;
}) {
  const action = updateOpportunityDecisionAction.bind(null, alertId);
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="mt-4 rounded-md border border-line-soft bg-surface-sunken p-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <label className="min-w-0 flex-1 text-xs text-ink-soft">
          Karar nedeni
          <select
            name="decision_reason"
            defaultValue={reason ?? ""}
            className="mt-1 w-full rounded-md border border-line bg-surface px-2.5 py-2 text-sm text-ink"
          >
            <option value="">Neden seçin</option>
            {reasons.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>
        </label>
        <div className="grid grid-cols-3 gap-2">
          <DecisionButton value="shortlisted" active={status === "shortlisted"} disabled={pending}>Kısa liste</DecisionButton>
          <DecisionButton value="rejected" active={status === "rejected"} disabled={pending}>Ele</DecisionButton>
          <DecisionButton value="actioned" active={status === "actioned"} disabled={pending}>İşleme al</DecisionButton>
        </div>
      </div>
      {state.error ? <p className="mt-2 text-xs text-danger">{state.error}</p> : null}
      {state.ok ? <p className="mt-2 text-xs text-success">{state.ok}</p> : null}
    </form>
  );
}

function DecisionButton({
  value,
  active,
  disabled,
  children,
}: {
  value: Exclude<ListingDecisionStatus, "new">;
  active: boolean;
  disabled: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="submit"
      name="decision_status"
      value={value}
      disabled={disabled}
      className={active
        ? "rounded-md bg-brand px-3 py-2 text-xs font-medium text-white disabled:opacity-50"
        : "rounded-md border border-line bg-surface px-3 py-2 text-xs font-medium text-ink-soft hover:border-brand hover:text-brand disabled:opacity-50"}
    >
      {children}
    </button>
  );
}

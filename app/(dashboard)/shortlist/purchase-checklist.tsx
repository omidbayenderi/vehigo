"use client";

import { useState, useTransition } from "react";
import { updateAcquisitionCostAction, updatePurchaseChecklistFieldAction } from "./actions";
import { calculateAcquisitionCost } from "@/lib/services/purchase-checklist";
import type { Database } from "@/lib/supabase/types";

type Checklist = Database["public"]["Tables"]["listing_purchase_checklist"]["Row"];

export type PurchaseChecklistField =
  | "vin"
  | "vin_verified"
  | "documents_checked"
  | "damage_inspected"
  | "seller_trustworthy"
  | "payment_risk_acceptable";

const checkFields: { key: PurchaseChecklistField; label: string }[] = [
  { key: "vin_verified", label: "VIN doğrulandı" },
  { key: "documents_checked", label: "Evraklar kontrol edildi" },
  { key: "damage_inspected", label: "Hasar durumu incelendi" },
  { key: "seller_trustworthy", label: "Satıcı güvenilir bulundu" },
  { key: "payment_risk_acceptable", label: "Ödeme riski kabul edilebilir" },
];

export default function PurchaseChecklist({
  listingId,
  listingPrice,
  currency,
  checklist,
}: {
  listingId: string;
  listingPrice: number | null;
  currency: string;
  checklist: Checklist;
}) {
  const [pending, startTransition] = useTransition();
  const [transport, setTransport] = useState(checklist.estimated_transport_cost);
  const [insurance, setInsurance] = useState(checklist.estimated_insurance_cost);
  const [customs, setCustoms] = useState(checklist.estimated_customs_cost);
  const [prep, setPrep] = useState(checklist.estimated_prep_cost);

  const total = calculateAcquisitionCost(listingPrice, {
    estimated_transport_cost: transport || 0,
    estimated_insurance_cost: insurance || 0,
    estimated_customs_cost: customs || 0,
    estimated_prep_cost: prep || 0,
  });

  return (
    <div className="space-y-4">
      <div>
        <label className="mb-1 block text-xs font-medium text-ink-faint" htmlFor={`${listingId}-vin`}>
          VIN (şasi no)
        </label>
        <input
          id={`${listingId}-vin`}
          defaultValue={checklist.vin ?? ""}
          disabled={pending}
          onBlur={(e) => startTransition(() => updatePurchaseChecklistFieldAction(listingId, "vin", e.target.value))}
          className="w-full rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15"
        />
      </div>

      <ul className="space-y-2">
        {checkFields.map((f) => (
          <li key={f.key} className="flex items-center gap-2">
            <input
              type="checkbox"
              id={`${listingId}-${f.key}`}
              defaultChecked={Boolean(checklist[f.key])}
              disabled={pending}
              onChange={(e) =>
                startTransition(() => {
                  updatePurchaseChecklistFieldAction(listingId, f.key, e.target.checked);
                })
              }
              className="h-4 w-4 rounded border-line"
            />
            <label htmlFor={`${listingId}-${f.key}`} className="text-sm text-ink-soft">
              {f.label}
            </label>
          </li>
        ))}
      </ul>

      {checklist.all_clear ? (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-success px-2.5 py-1 text-xs font-semibold text-white">
          ✓ Risk kontrolü tamam
        </span>
      ) : (
        <p className="text-xs font-medium text-warning">Satın almadan önce tüm kutular işaretlenmeli.</p>
      )}

      <form
        action={updateAcquisitionCostAction.bind(null, listingId)}
        className="space-y-3 border-t border-line-soft pt-3"
      >
        <p className="text-xs font-medium text-ink-soft">Toplam edinme maliyeti tahmini</p>
        <div className="grid grid-cols-2 gap-2">
          <CostField label="Nakliye" name="estimated_transport_cost" value={transport} onChange={setTransport} />
          <CostField label="Sigorta" name="estimated_insurance_cost" value={insurance} onChange={setInsurance} />
          <CostField label="Gümrük tahmini" name="estimated_customs_cost" value={customs} onChange={setCustoms} />
          <CostField label="Hazırlık" name="estimated_prep_cost" value={prep} onChange={setPrep} />
        </div>
        <div className="flex items-center justify-between rounded-md border border-line-soft bg-paper px-3 py-2 text-sm">
          <span className="text-ink-soft">Toplam edinme maliyeti</span>
          <span className="font-semibold text-ink">
            {total.toLocaleString("tr-TR")} {currency}
          </span>
        </div>
        <button
          type="submit"
          className="rounded-md border border-line px-3 py-2 text-sm text-ink-soft transition-colors hover:bg-surface-sunken hover:text-ink"
        >
          Maliyet tahminini kaydet
        </button>
      </form>
    </div>
  );
}

function CostField({
  label,
  name,
  value,
  onChange,
}: {
  label: string;
  name: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-ink-faint" htmlFor={name}>
        {label}
      </label>
      <input
        id={name}
        name={name}
        type="number"
        step="0.01"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full rounded-md border border-line bg-surface px-2 py-1.5 text-sm text-ink focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15"
      />
    </div>
  );
}

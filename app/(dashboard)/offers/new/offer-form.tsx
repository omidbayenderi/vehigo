"use client";

import { useActionState, useMemo, useState } from "react";
import { calculateOffer } from "@/lib/services/offers";
import { createOfferAction, type FormState } from "../actions";

const initialState: FormState = {};

type Props = {
  leadId: string;
  vehicleId: string;
  leadName: string;
  vehicleLabel: string;
  defaultPrice: number;
  defaultCurrency: string;
};

export default function OfferForm({
  leadId,
  vehicleId,
  leadName,
  vehicleLabel,
  defaultPrice,
  defaultCurrency,
}: Props) {
  const [state, formAction, pending] = useActionState(createOfferAction, initialState);

  const [basePrice, setBasePrice] = useState(defaultPrice);
  const [exportFee, setExportFee] = useState(0);
  const [transport, setTransport] = useState(0);
  const [insurance, setInsurance] = useState(0);
  const [customs, setCustoms] = useState(0);
  const [serviceFee, setServiceFee] = useState(0);
  const [commissionType, setCommissionType] = useState<"fixed" | "percentage">("fixed");
  const [commissionValue, setCommissionValue] = useState(0);

  const result = useMemo(
    () =>
      calculateOffer({
        baseVehiclePrice: basePrice || 0,
        exportCompanyFee: exportFee || 0,
        transportCost: transport || 0,
        insuranceCost: insurance || 0,
        iranCustomsEstimate: customs || 0,
        internalServiceFee: serviceFee || 0,
        commissionType,
        commissionValue: commissionValue || 0,
      }),
    [basePrice, exportFee, transport, insurance, customs, serviceFee, commissionType, commissionValue],
  );

  return (
    <form action={formAction} className="space-y-4 rounded-lg border border-line-soft bg-surface p-6 shadow-[0_1px_2px_rgba(23,24,43,0.04)]">
      <input type="hidden" name="lead_id" value={leadId} />
      <input type="hidden" name="vehicle_id" value={vehicleId} />

      <div className="mb-2 rounded-md bg-paper p-3 text-sm text-ink-soft">
        <p>
          <span className="font-medium text-ink">Müşteri:</span> {leadName}
        </p>
        <p>
          <span className="font-medium text-ink">Araç:</span> {vehicleLabel}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <NumberField
          label="Araç fiyatı"
          name="base_vehicle_price"
          value={basePrice}
          onChange={setBasePrice}
        />
        <Field label="Para birimi" name="currency" defaultValue={defaultCurrency} />
        <NumberField
          label="İhracat şirketi ücreti"
          name="export_company_fee"
          value={exportFee}
          onChange={setExportFee}
        />
        <NumberField label="Nakliye maliyeti" name="transport_cost" value={transport} onChange={setTransport} />
        <NumberField label="Sigorta" name="insurance_cost" value={insurance} onChange={setInsurance} />
        <NumberField
          label="İran gümrük tahmini"
          name="iran_customs_estimate"
          value={customs}
          onChange={setCustoms}
        />
        <NumberField
          label="İç hizmet ücreti"
          name="internal_service_fee"
          value={serviceFee}
          onChange={setServiceFee}
        />
        <div>
          <label className="mb-1 block text-sm font-medium text-ink-soft" htmlFor="commission_type">Komisyon tipi</label>
          <select
            id="commission_type"
            name="commission_type"
            value={commissionType}
            onChange={(e) => setCommissionType(e.target.value as "fixed" | "percentage")}
            className="w-full rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15"
          >
            <option value="fixed">Sabit tutar</option>
            <option value="percentage">Yüzde</option>
          </select>
        </div>
        <NumberField
          label={commissionType === "percentage" ? "Komisyon (%)" : "Komisyon tutarı"}
          name="commission_value"
          value={commissionValue}
          onChange={setCommissionValue}
        />
        <Field label="Geçerlilik tarihi" name="validity_date" type="date" />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-ink-soft">Teslimat koşulları</label>
        <textarea
          name="delivery_terms"
          rows={2}
          className="w-full rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15"
        />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-ink-soft">Ödeme adımları</label>
        <textarea
          name="payment_steps"
          rows={2}
          className="w-full rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15"
        />
      </div>

      <div className="rounded-md border border-line-soft bg-paper p-4 text-sm">
        <div className="flex justify-between">
          <span className="text-ink-soft">Ara toplam</span>
          <span className="font-medium text-ink">
            {result.subtotal.toLocaleString("tr-TR")} {defaultCurrency}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-ink-soft">Komisyon</span>
          <span className="font-medium text-ink">
            {result.commissionAmount.toLocaleString("tr-TR")} {defaultCurrency}
          </span>
        </div>
        <div className="mt-2 flex justify-between border-t border-line-soft pt-2 text-base">
          <span className="font-semibold text-ink">Müşteriye toplam</span>
          <span className="font-semibold text-ink">
            {result.finalCustomerPrice.toLocaleString("tr-TR")} {defaultCurrency}
          </span>
        </div>
      </div>

      {state.error ? <p className="text-sm text-danger">{state.error}</p> : null}

      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-ink disabled:opacity-50"
      >
        {pending ? "Oluşturuluyor..." : "Teklif oluştur"}
      </button>
    </form>
  );
}

function Field({
  label,
  name,
  type = "text",
  defaultValue,
}: {
  label: string;
  name: string;
  type?: string;
  defaultValue?: string;
}) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-ink-soft" htmlFor={name}>
        {label}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        defaultValue={defaultValue}
        className="w-full rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15"
      />
    </div>
  );
}

function NumberField({
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
      <label className="mb-1 block text-sm font-medium text-ink-soft" htmlFor={name}>
        {label}
      </label>
      <input
        id={name}
        name={name}
        type="number"
        step="0.01"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15"
      />
    </div>
  );
}

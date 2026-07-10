"use client";

import { useActionState } from "react";
import { createLeadAction, type FormState } from "../actions";

const initialState: FormState = {};

const sources = [
  { value: "instagram", label: "Instagram" },
  { value: "telegram", label: "Telegram" },
  { value: "divar", label: "Divar" },
  { value: "sheypoor", label: "Sheypoor" },
  { value: "google_maps", label: "Google Maps" },
  { value: "referral", label: "Referans" },
  { value: "manual", label: "Manuel" },
];

export default function NewLeadPage() {
  const [state, formAction, pending] = useActionState(createLeadAction, initialState);

  return (
    <div className="max-w-2xl">
      <h1 className="mb-6 text-2xl font-serif font-semibold text-ink">Yeni müşteri</h1>
      <form action={formAction} className="space-y-4 rounded-lg border border-line-soft bg-surface p-6 shadow-[0_1px_2px_rgba(23,24,43,0.04)]">
        <div className="grid grid-cols-2 gap-4">
          <Field label="İsim / Şirket" name="company_or_name" required />
          <Field label="Şehir" name="city" />
          <Field label="WhatsApp" name="phone_whatsapp" />
          <Field label="Telegram" name="telegram_handle" />
          <Field label="Instagram" name="instagram_handle" />
          <Field label="İşletme tipi" name="business_type" />
          <Field label="İstenen araç tipi" name="desired_vehicle_type" />
          <SelectField label="Kaynak" name="source" options={sources} />
          <Field label="Min bütçe" name="budget_min" type="number" />
          <Field label="Max bütçe" name="budget_max" type="number" />
          <Field label="Bütçe para birimi" name="budget_currency" defaultValue="EUR" />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-ink-soft">Notlar</label>
          <textarea
            name="notes"
            rows={3}
            className="w-full rounded-md border border-line px-3 py-2 text-sm focus:border-brand focus:outline-none"
          />
        </div>

        {state.error ? <p className="text-sm text-danger">{state.error}</p> : null}

        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-ink disabled:opacity-50"
        >
          {pending ? "Kaydediliyor..." : "Kaydet"}
        </button>
      </form>
    </div>
  );
}

function Field({
  label,
  name,
  type = "text",
  required,
  defaultValue,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
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
        required={required}
        defaultValue={defaultValue}
        className="w-full rounded-md border border-line px-3 py-2 text-sm focus:border-brand focus:outline-none"
      />
    </div>
  );
}

function SelectField({
  label,
  name,
  options,
}: {
  label: string;
  name: string;
  options: { value: string; label: string }[];
}) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-ink-soft" htmlFor={name}>
        {label}
      </label>
      <select
        id={name}
        name={name}
        defaultValue=""
        className="w-full rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15"
      >
        <option value="">Seçin</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

"use client";

import { useActionState } from "react";
import { createVehicleAction, type FormState } from "../actions";

const initialState: FormState = {};

const vehicleTypes = [
  { value: "truck", label: "Kamyon" },
  { value: "trailer", label: "Römork" },
  { value: "construction", label: "İş Makinesi" },
  { value: "spare_part", label: "Yedek Parça" },
  { value: "bus", label: "Otobüs" },
  { value: "other", label: "Diğer" },
];

const conditions = [
  { value: "new", label: "Yeni" },
  { value: "used_excellent", label: "İkinci El - Çok İyi" },
  { value: "used_good", label: "İkinci El - İyi" },
  { value: "used_fair", label: "İkinci El - Orta" },
  { value: "damaged", label: "Hasarlı" },
];

export default function NewVehiclePage() {
  const [state, formAction, pending] = useActionState(createVehicleAction, initialState);

  return (
    <div className="max-w-2xl">
      <h1 className="mb-6 text-2xl font-semibold text-zinc-900">Yeni araç</h1>
      <form action={formAction} className="space-y-4 rounded-lg border border-zinc-200 bg-white p-6">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Marka" name="brand" required />
          <Field label="Model" name="model" required />
          <Field label="Yıl" name="year" type="number" />
          <Field label="Kilometre" name="mileage_km" type="number" />
          <Field label="Fiyat" name="price" type="number" step="0.01" required />
          <Field label="Para birimi" name="currency" defaultValue="EUR" />
          <SelectField label="Araç tipi" name="vehicle_type" options={vehicleTypes} required />
          <SelectField label="Durum" name="condition" options={conditions} />
          <Field label="Euro sınıfı" name="euro_class" />
          <Field label="İlan linki" name="listing_url" />
          <Field label="Satıcı" name="seller_name" />
          <Field label="Satıcı ülkesi" name="seller_country" />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-zinc-700">Notlar</label>
          <textarea
            name="notes"
            rows={3}
            className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none"
          />
        </div>

        {state.error ? <p className="text-sm text-red-600">{state.error}</p> : null}

        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50"
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
  step,
  required,
  defaultValue,
}: {
  label: string;
  name: string;
  type?: string;
  step?: string;
  required?: boolean;
  defaultValue?: string;
}) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-zinc-700" htmlFor={name}>
        {label}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        step={step}
        required={required}
        defaultValue={defaultValue}
        className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none"
      />
    </div>
  );
}

function SelectField({
  label,
  name,
  options,
  required,
}: {
  label: string;
  name: string;
  options: { value: string; label: string }[];
  required?: boolean;
}) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-zinc-700" htmlFor={name}>
        {label}
      </label>
      <select
        id={name}
        name={name}
        required={required}
        defaultValue=""
        className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none"
      >
        <option value="" disabled>
          Seçin
        </option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

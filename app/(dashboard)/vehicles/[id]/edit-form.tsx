"use client";

import { useActionState } from "react";
import type { Database } from "@/lib/supabase/types";
import { updateVehicleAction, type FormState } from "../actions";

type Vehicle = Database["public"]["Tables"]["vehicles"]["Row"];

const initialState: FormState = {};

const vehicleTypes = [
  { value: "truck", label: "Kamyon" },
  { value: "trailer", label: "Römork" },
  { value: "construction", label: "İş Makinesi" },
  { value: "spare_part", label: "Yedek Parça" },
  { value: "bus", label: "Otobüs" },
  { value: "other", label: "Diğer" },
];

const availabilityOptions = [
  { value: "available", label: "Uygun" },
  { value: "reserved", label: "Rezerve" },
  { value: "sold", label: "Satıldı" },
  { value: "expired", label: "Süresi Doldu" },
];

export default function EditVehicleForm({ vehicle }: { vehicle: Vehicle }) {
  const action = updateVehicleAction.bind(null, vehicle.id);
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="space-y-4 rounded-lg border border-line-soft bg-white p-6">
      <div className="grid grid-cols-2 gap-4">
        <Field label="Marka" name="brand" defaultValue={vehicle.brand ?? ""} required />
        <Field label="Model" name="model" defaultValue={vehicle.model ?? ""} required />
        <Field label="Yıl" name="year" type="number" defaultValue={vehicle.year?.toString() ?? ""} />
        <Field
          label="Kilometre"
          name="mileage_km"
          type="number"
          defaultValue={vehicle.mileage_km?.toString() ?? ""}
        />
        <Field
          label="Fiyat"
          name="price"
          type="number"
          step="0.01"
          defaultValue={vehicle.price?.toString() ?? ""}
          required
        />
        <Field label="Para birimi" name="currency" defaultValue={vehicle.currency} />
        <SelectField
          label="Araç tipi"
          name="vehicle_type"
          options={vehicleTypes}
          defaultValue={vehicle.vehicle_type ?? ""}
          required
        />
        <SelectField
          label="Durum"
          name="availability_status"
          options={availabilityOptions}
          defaultValue={vehicle.availability_status}
        />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-ink-soft">Notlar</label>
        <textarea
          name="notes"
          rows={3}
          defaultValue={vehicle.notes ?? ""}
          className="w-full rounded-md border border-line px-3 py-2 text-sm focus:border-brand focus:outline-none"
        />
      </div>

      {state.error ? <p className="text-sm text-danger">{state.error}</p> : null}

      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-ink disabled:opacity-50"
      >
        {pending ? "Kaydediliyor..." : "Güncelle"}
      </button>
    </form>
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
      <label className="mb-1 block text-sm font-medium text-ink-soft" htmlFor={name}>
        {label}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        step={step}
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
  required,
  defaultValue,
}: {
  label: string;
  name: string;
  options: { value: string; label: string }[];
  required?: boolean;
  defaultValue?: string;
}) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-ink-soft" htmlFor={name}>
        {label}
      </label>
      <select
        id={name}
        name={name}
        required={required}
        defaultValue={defaultValue}
        className="w-full rounded-md border border-line bg-white px-3 py-2 text-sm focus:border-brand focus:outline-none"
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

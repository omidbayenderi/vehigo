"use client";

import { useActionState } from "react";
import { createWatchlistAction, type FormState } from "./actions";
import type { Database } from "@/lib/supabase/types";

type Source = Database["public"]["Tables"]["market_sources"]["Row"];

const initialState: FormState = {};

export default function WatchlistForm({ sources }: { sources: Source[] }) {
  const [state, formAction, pending] = useActionState(createWatchlistAction, initialState);

  return (
    <form action={formAction} className="rounded-lg border border-zinc-200 bg-white p-5">
      <h2 className="mb-4 text-sm font-medium text-zinc-900">Yeni alarm kuralı</h2>

      <div className="grid gap-3 md:grid-cols-3">
        <Field label="Alarm adı" name="name" required placeholder="Actros Almanya" />
        <Field label="Ülke" name="country" placeholder="Germany" />
        <Field label="Şehir" name="city" placeholder="Berlin" />
        <Field label="Marka" name="brand" placeholder="Mercedes-Benz" />
        <Field label="Model" name="model" placeholder="Actros" />
        <label className="text-sm">
          <span className="mb-1 block text-zinc-600">Araç tipi</span>
          <select name="vehicle_type" className="w-full rounded-md border border-zinc-300 px-3 py-2">
            <option value="">Farketmez</option>
            <option value="truck">Kamyon</option>
            <option value="trailer">Dorse</option>
            <option value="construction">İş makinesi</option>
            <option value="spare_part">Yedek parça</option>
            <option value="bus">Otobüs</option>
            <option value="other">Diğer</option>
          </select>
        </label>
        <Field label="Min yıl" name="min_year" type="number" />
        <Field label="Max yıl" name="max_year" type="number" />
        <Field label="Max km" name="max_mileage_km" type="number" />
        <Field label="Min fiyat" name="min_price" type="number" />
        <Field label="Max fiyat" name="max_price" type="number" />
        <Field label="Para birimi" name="currency" defaultValue="EUR" />
      </div>

      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <label className="text-sm">
          <span className="mb-1 block text-zinc-600">Kaynaklar</span>
          <input
            name="source_keys"
            defaultValue={sources.map((source) => source.key).join(",")}
            className="w-full rounded-md border border-zinc-300 px-3 py-2"
          />
          <span className="mt-1 block text-xs text-zinc-500">
            Virgülle ayırın: {sources.map((source) => source.key).join(", ")}
          </span>
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-zinc-600">Anahtar kelimeler</span>
          <input
            name="keywords"
            placeholder="retarder, euro 6"
            className="w-full rounded-md border border-zinc-300 px-3 py-2"
          />
          <span className="mt-1 block text-xs text-zinc-500">Tüm kelimeler ilanda geçerse alarm üretilir.</span>
        </label>
      </div>

      <button
        type="submit"
        disabled={pending}
        className="mt-4 rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50"
      >
        {pending ? "Oluşturuluyor..." : "Alarm oluştur"}
      </button>

      {state.error ? <p className="mt-2 text-sm text-red-600">{state.error}</p> : null}
      {state.ok ? <p className="mt-2 text-sm text-green-700">{state.ok}</p> : null}
    </form>
  );
}

function Field({
  label,
  name,
  type = "text",
  required,
  placeholder,
  defaultValue,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  placeholder?: string;
  defaultValue?: string;
}) {
  return (
    <label className="text-sm">
      <span className="mb-1 block text-zinc-600">{label}</span>
      <input
        type={type}
        name={name}
        required={required}
        placeholder={placeholder}
        defaultValue={defaultValue}
        className="w-full rounded-md border border-zinc-300 px-3 py-2"
      />
    </label>
  );
}

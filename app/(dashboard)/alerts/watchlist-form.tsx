"use client";

import { useActionState } from "react";
import { createWatchlistAction, type FormState } from "./actions";
import type { Database } from "@/lib/supabase/types";

type Source = Database["public"]["Tables"]["market_sources"]["Row"];

const initialState: FormState = {};

export default function WatchlistForm({ sources }: { sources: Source[] }) {
  const [state, formAction, pending] = useActionState(createWatchlistAction, initialState);

  return (
    <form action={formAction} className="rounded-lg border border-line-soft bg-surface p-5 shadow-[0_1px_2px_rgba(23,24,43,0.04)]">
      <h2 className="mb-4 text-sm font-medium text-ink">Yeni alarm kuralı</h2>

      <div className="grid gap-3 md:grid-cols-3">
        <Field label="Alarm adı" name="name" required placeholder="Actros Almanya" />
        <Field label="Ülke" name="country" placeholder="Germany" />
        <Field label="Şehir" name="city" placeholder="Berlin" />
        <Field label="Marka" name="brand" placeholder="Mercedes-Benz" />
        <Field label="Model" name="model" placeholder="Actros" />
        <label className="text-sm">
          <span className="mb-1 block text-ink-soft">Araç tipi</span>
          <select name="vehicle_type" className="w-full rounded-md border border-line bg-surface px-3 py-2 text-ink focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15">
            <option value="">Farketmez</option>
            <option value="car">Otomobil</option>
            <option value="van">Hafif ticari / Van</option>
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
        <Field label="Hedef fırsat fiyatı" name="target_price" type="number" />
        <Field label="Para birimi" name="currency" defaultValue="EUR" />
      </div>

      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <fieldset className="text-sm">
          <legend className="mb-1 block text-ink-soft">Arama kaynakları</legend>
          <div className="flex min-h-10 flex-wrap gap-3 rounded-md border border-line bg-surface px-3 py-2">
            {sources.filter((source) => source.enabled).map((source) => (
              <label key={source.key} className="inline-flex items-center gap-2 text-ink">
                <input type="checkbox" name="source_keys" value={source.key} defaultChecked />
                {source.name}
              </label>
            ))}
          </div>
          <span className="mt-1 block text-xs text-ink-faint">Seçim yapmazsanız tüm aktif kaynaklar taranır.</span>
        </fieldset>
        <label className="text-sm">
          <span className="mb-1 block text-ink-soft">Anahtar kelimeler</span>
          <input
            name="keywords"
            placeholder="retarder, euro 6"
            className="w-full rounded-md border border-line bg-surface px-3 py-2 text-ink focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15"
          />
          <span className="mt-1 block text-xs text-ink-faint">Tüm kelimeler ilanda geçerse alarm üretilir.</span>
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-ink-soft">Olmazsa olmaz kelimeler</span>
          <input
            name="must_have_keywords"
            placeholder="retarder, euro 6"
            className="w-full rounded-md border border-line bg-surface px-3 py-2 text-ink focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15"
          />
          <span className="mt-1 block text-xs text-ink-faint">Eksikse fırsat skoru ciddi düşer.</span>
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-ink-soft">Hariç tutulacak kelimeler</span>
          <input
            name="excluded_keywords"
            placeholder="damaged, accident, parts only"
            className="w-full rounded-md border border-line bg-surface px-3 py-2 text-ink focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15"
          />
          <span className="mt-1 block text-xs text-ink-faint">Geçerse fırsat skoru ciddi düşer.</span>
        </label>
      </div>

      <button
        type="submit"
        disabled={pending}
        className="mt-4 rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-ink disabled:opacity-50"
      >
        {pending ? "Oluşturuluyor..." : "Alarm oluştur"}
      </button>

      {state.error ? <p className="mt-2 text-sm text-danger">{state.error}</p> : null}
      {state.ok ? <p className="mt-2 text-sm text-success">{state.ok}</p> : null}
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
      <span className="mb-1 block text-ink-soft">{label}</span>
      <input
        type={type}
        name={name}
        required={required}
        placeholder={placeholder}
        defaultValue={defaultValue}
        className="w-full rounded-md border border-line bg-surface px-3 py-2 text-ink focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15"
      />
    </label>
  );
}

"use client";

import { useActionState, useState } from "react";
import { createWatchlistAction, type FormState } from "./actions";
import type { Database } from "@/lib/supabase/types";

type Source = Database["public"]["Tables"]["market_sources"]["Row"];

const initialState: FormState = {};
const EUROPEAN_COUNTRIES = [
  "Almanya", "Avusturya", "Belçika", "Bulgaristan", "Çekya", "Danimarka", "Estonya",
  "Finlandiya", "Fransa", "Hırvatistan", "Hollanda", "İrlanda", "İspanya", "İsveç",
  "İtalya", "Kıbrıs", "Letonya", "Litvanya", "Lüksemburg", "Macaristan", "Malta",
  "Norveç", "Polonya", "Portekiz", "Romanya", "Slovakya", "Slovenya", "Yunanistan",
];

export default function WatchlistForm({ sources }: { sources: Source[] }) {
  const [state, formAction, pending] = useActionState(createWatchlistAction, initialState);
  const [vehicleType, setVehicleType] = useState("");
  const enabledSources = sources.filter((source) => source.enabled);
  const [selectedSources, setSelectedSources] = useState(() => new Set(
    enabledSources
      .filter((source) => source.method === "scrape" || source.method === "web_search")
      .map((source) => source.key),
  ));
  const setSourceChecked = (key: string, checked: boolean) => {
    setSelectedSources((current) => {
      const next = new Set(current);
      if (checked) next.add(key); else next.delete(key);
      return next;
    });
  };

  return (
    <form action={formAction} className="rounded-lg border border-line-soft bg-surface p-5 shadow-[0_1px_2px_rgba(23,24,43,0.04)]">
      <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-base font-semibold text-ink">Avrupa Deep Search oluştur</h2>
          <p className="mt-1 max-w-2xl text-sm text-ink-faint">
            Aracı bir kez tarif edin; Vehigo yerel pazarları, genel web indeksini ve bağlı n8n akışlarını sizin yerinize tekrar tekrar tarasın.
          </p>
        </div>
        <span className="w-fit rounded-full bg-success/10 px-3 py-1 text-xs font-medium text-success">40+ pazar alan adı</span>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <Field label="Alarm adı" name="name" required placeholder="Actros Almanya" />
        <label className="text-sm">
          <span className="mb-1 block text-ink-soft">Ülke</span>
          <input
            name="country"
            list="european-countries"
            placeholder="Tüm Avrupa"
            className="w-full rounded-md border border-line bg-surface px-3 py-2 text-ink focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15"
          />
          <datalist id="european-countries">
            {EUROPEAN_COUNTRIES.map((country) => <option key={country} value={country} />)}
          </datalist>
        </label>
        <Field label="Şehir" name="city" placeholder="Berlin" />
        <Field label="Marka" name="brand" placeholder="Mercedes-Benz" />
        <Field label="Model" name="model" placeholder="Actros" />
        <label className="text-sm">
          <span className="mb-1 block text-ink-soft">Araç tipi</span>
          <select
            name="vehicle_type"
            value={vehicleType}
            onChange={(event) => setVehicleType(event.target.value)}
            className="w-full rounded-md border border-line bg-surface px-3 py-2 text-ink focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15"
          >
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
        {vehicleType === "car" ? <Field label="Koltuk sayısı" name="seat_count" type="number" /> : null}
        <label className="text-sm">
          <span className="mb-1 block text-ink-soft">Araç durumu</span>
          <select name="condition" className="w-full rounded-md border border-line bg-surface px-3 py-2 text-ink focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15">
            <option value="">Farketmez</option>
            <option value="new">Sıfır</option>
            <option value="used_excellent">İkinci el - çok iyi</option>
            <option value="used_good">İkinci el - iyi</option>
            <option value="used_fair">İkinci el - normal</option>
            <option value="damaged">Kazalı / hasarlı</option>
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
          <div className="mb-1 flex items-center justify-between gap-3">
            <legend className="text-ink-soft">Arama ağı</legend>
            <div className="flex gap-2 text-xs">
              <button type="button" onClick={() => setSelectedSources(new Set(enabledSources.map((source) => source.key)))} className="font-medium text-brand hover:underline">Hepsini seç</button>
              <button type="button" onClick={() => setSelectedSources(new Set())} className="text-ink-faint hover:text-ink">Temizle</button>
            </div>
          </div>
          <div className="rounded-md border border-line bg-surface p-3">
            {sources.filter((source) => source.enabled && (source.method === "scrape" || source.method === "web_search")).map((source) => (
              <label key={source.key} className="inline-flex items-center gap-2 text-ink">
                <input
                  type="checkbox"
                  name="source_keys"
                  value={source.key}
                  checked={selectedSources.has(source.key)}
                  onChange={(event) => setSourceChecked(source.key, event.target.checked)}
                />
                {source.key === "brave_web" ? "Avrupa Deep Search" : source.name}
                <span className="text-xs text-ink-faint">
                  {source.key === "brave_web" ? "(40+ yerel pazar + açık sosyal sonuçlar)" : "(doğrudan otomatik)"}
                </span>
              </label>
            ))}
            <details className="mt-3 border-t border-line-soft pt-3">
              <summary className="cursor-pointer text-xs font-medium text-brand">Bağlanabilir kayıtlı arama kaynakları</summary>
              <div className="mt-3 flex max-h-40 flex-wrap gap-3 overflow-y-auto pr-2">
                {sources.filter((source) => source.enabled && source.method === "email_alert").map((source) => (
                  <label key={source.key} className="inline-flex items-center gap-2 text-xs text-ink">
                    <input type="checkbox" name="source_keys" value={source.key} checked={selectedSources.has(source.key)} onChange={(event) => setSourceChecked(source.key, event.target.checked)} />
                    {source.name}
                  </label>
                ))}
              </div>
            </details>
          </div>
          <span className="mt-1 block text-xs text-ink-faint">
            {selectedSources.size}/{enabledSources.length} kaynak seçili. Deep Search merkezi agent tarafından otomatik taranır; e-posta kaynakları ek kapsama sağlar.
          </span>
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

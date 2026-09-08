"use client";

import { useActionState, useState } from "react";
import { createWatchlistAction, type FormState } from "./actions";
import type { Database } from "@/lib/supabase/types";
import DetailedVehicleFilters from "./detailed-vehicle-filters";
import NaturalLanguagePlanner from "./natural-language-planner";
import GeographyFields from "./geography-fields";
import VehicleTypePicker from "./vehicle-type-picker";

type Source = Database["public"]["Tables"]["market_sources"]["Row"];

const initialState: FormState = {};
export default function WatchlistForm({ sources }: { sources: Source[] }) {
  const [state, formAction, pending] = useActionState(createWatchlistAction, initialState);
  const [vehicleType, setVehicleType] = useState("");
  const enabledSources = sources.filter((source) => source.enabled);
  const [selectedSources, setSelectedSources] = useState(() => new Set(
    enabledSources
      .filter((source) => source.method === "scrape" || source.method === "web_search" || source.method === "api")
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

      <NaturalLanguagePlanner />
      <GeographyFields />

      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <Field label="Alarm adı" name="name" required placeholder="Actros Almanya" />
        <Field label="Şehir" name="city" placeholder="Berlin" />
        <Field label="Marka" name="brand" placeholder="Mercedes-Benz" />
        <Field label="Model" name="model" placeholder="Actros" />
        <div className="md:col-span-3">
          <VehicleTypePicker name="vehicle_type" value={vehicleType} onChange={setVehicleType} />
        </div>
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

      <DetailedVehicleFilters />

      <details open className="mt-4 rounded-lg border border-line-soft bg-surface-sunken/40 p-4">
        <summary className="cursor-pointer text-sm font-semibold text-brand">Ticari alım profili</summary>
        <p className="mt-2 text-xs text-ink-faint">Anlık alarm ancak piyasa örneklemi, net kâr ve marj hedeflerinin tamamı doğrulanırsa gönderilir.</p>
        <div className="mt-4 grid gap-3 md:grid-cols-4">
          <Field label="Hedef ülke kodu" name="destination_country_code" placeholder="IR" />
          <Field label="Sabit ek maliyet (€)" name="estimated_fixed_costs" type="number" defaultValue="0" />
          <Field label="Aylık bekleme maliyeti (€)" name="monthly_holding_cost" type="number" defaultValue="0" />
          <Field label="Maliyet rezervi (%)" name="cost_reserve_percent" type="number" defaultValue="10" />
          <Field label="Muhafazakâr satış indirimi (%)" name="conservative_sale_discount_percent" type="number" defaultValue="5" />
          <Field label="Minimum net kâr (€)" name="min_net_profit" type="number" defaultValue="3000" />
          <Field label="Minimum net marj (%)" name="min_net_margin_percent" type="number" defaultValue="12" />
          <Field label="Maksimum stok günü" name="max_inventory_days" type="number" defaultValue="45" />
          <Field label="Anlık alarm skor eşiği" name="instant_alert_score" type="number" defaultValue="85" />
        </div>
      </details>

      <details className="mt-4 rounded-lg border border-line-soft bg-surface-sunken/40 p-4">
        <summary className="cursor-pointer text-sm font-semibold text-brand">Arama davranışı ve sıralama</summary>
        <div className="mt-4 grid gap-3 md:grid-cols-4">
          <label className="text-sm"><span className="mb-1 block text-ink-soft">Eşleşme modu</span><select name="search_mode" defaultValue="strict" className={inputClass}><option value="strict">Strict · filtreleri kesin uygula</option><option value="discovery">Discovery · ikincil eksikleri doğrula</option></select></label>
          <Field label="Tazelik (saat)" name="freshness_hours" type="number" defaultValue="168" />
          <label className="text-sm"><span className="mb-1 block text-ink-soft">Sıralama</span><select name="sort_by" defaultValue="relevance" className={inputClass}><option value="relevance">Uygunluk</option><option value="newest">En yeni</option><option value="price">Fiyat</option><option value="mileage">Kilometre</option><option value="year">Model yılı</option></select></label>
          <label className="text-sm"><span className="mb-1 block text-ink-soft">Yön</span><select name="sort_direction" defaultValue="desc" className={inputClass}><option value="desc">Azalan</option><option value="asc">Artan</option></select></label>
          <Field label="Sayfa boyutu" name="page_size" type="number" defaultValue="25" />
        </div>
      </details>

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
            {sources.filter((source) => source.enabled && (source.method === "scrape" || source.method === "web_search" || source.method === "api")).map((source) => (
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
              <summary className="cursor-pointer text-xs font-medium text-brand">Ek bağlantıyla güçlendirilebilen kaynaklar</summary>
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
            {selectedSources.size}/{enabledSources.length} kaynak seçili. Deep Search e-posta olmadan keşif yapar; e-posta/API bağlantısı yalnız daha hızlı ve eksiksiz kapsama sağlar.
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
          <span className="mt-1 block text-xs text-ink-faint">Virgülle ayırın. Yazdığınız kelimelerin tümü ilanda geçmelidir.</span>
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

const inputClass = "min-h-11 w-full rounded-md border border-line bg-surface px-3 py-2 text-base text-ink focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15";

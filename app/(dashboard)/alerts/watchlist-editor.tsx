"use client";

import { useActionState, useState, useTransition } from "react";
import { Pencil, Trash2, X } from "lucide-react";
import type { Database, VehicleCondition } from "@/lib/supabase/types";
import { deleteWatchlistAction, editWatchlistAction, type FormState } from "./actions";
import DetailedVehicleFilters, { detailValuesFromWatchlist } from "./detailed-vehicle-filters";
import NaturalLanguagePlanner from "./natural-language-planner";
import GeographyFields from "./geography-fields";
import VehicleTypePicker from "./vehicle-type-picker";

type Watchlist = Database["public"]["Tables"]["watchlists"]["Row"];
type Source = Database["public"]["Tables"]["market_sources"]["Row"];
const initialState: FormState = {};

export default function WatchlistEditor({
  watchlist,
  sources,
  seatCount,
  condition,
}: {
  watchlist: Watchlist;
  sources: Source[];
  seatCount: number | null;
  condition: VehicleCondition | null;
}) {
  const [open, setOpen] = useState(false);
  const enabledSources = sources.filter((source) => source.enabled);
  const [selectedSources, setSelectedSources] = useState(() => new Set(watchlist.source_keys));
  const [vehicleType, setVehicleType] = useState(watchlist.vehicle_type ?? "");
  const [state, action, pending] = useActionState(editWatchlistAction.bind(null, watchlist.id), initialState);
  const [deleting, startDelete] = useTransition();

  const toggleSource = (key: string, checked: boolean) => setSelectedSources((current) => {
    const next = new Set(current);
    if (checked) next.add(key); else next.delete(key);
    return next;
  });

  const remove = () => {
    if (!window.confirm(`“${watchlist.name}” filtresi ve ona bağlı alarm geçmişi silinsin mi?`)) return;
    startDelete(async () => {
      const result = await deleteWatchlistAction(watchlist.id);
      if (result.error) window.alert(result.error);
    });
  };

  if (!open) {
    return (
      <div className="flex gap-2">
        <button type="button" onClick={() => setOpen(true)} className="inline-flex min-h-11 items-center gap-1.5 rounded-md border border-line px-3 text-xs font-medium text-ink-soft hover:bg-surface-sunken">
          <Pencil size={14} aria-hidden="true" /> Düzenle
        </button>
        <button type="button" disabled={deleting} onClick={remove} className="inline-flex min-h-11 items-center gap-1.5 rounded-md border border-danger/30 px-3 text-xs font-medium text-danger hover:bg-danger/5 disabled:opacity-50">
          <Trash2 size={14} aria-hidden="true" /> {deleting ? "Siliniyor" : "Sil"}
        </button>
      </div>
    );
  }

  return (
    <form action={action} className="mt-4 rounded-lg border border-brand/30 bg-surface p-4">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-medium text-ink">Filtreyi düzenle</h3>
        <button type="button" onClick={() => setOpen(false)} aria-label="Düzenlemeyi kapat" className="grid size-11 place-items-center rounded-md text-ink-faint hover:bg-surface-sunken hover:text-ink"><X size={18} /></button>
      </div>

      <NaturalLanguagePlanner defaultQuery={watchlist.natural_language_query} defaultPlan={watchlist.search_plan} />
      <GeographyFields
        countryCodes={watchlist.country_codes}
        regionPreset={watchlist.region_preset}
        centerLatitude={watchlist.center_latitude}
        centerLongitude={watchlist.center_longitude}
        radiusKm={watchlist.radius_km}
      />

      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <Field label="Alarm adı" name="name" required value={watchlist.name} />
        <Field label="Şehir" name="city" value={watchlist.city} />
        <Field label="Marka" name="brand" value={watchlist.brand} />
        <Field label="Model" name="model" value={watchlist.model} />
        <div className="md:col-span-3">
          <VehicleTypePicker name="vehicle_type" value={vehicleType} onChange={setVehicleType} />
        </div>
        <Field label="Min yıl" name="min_year" type="number" value={watchlist.min_year} />
        <Field label="Max yıl" name="max_year" type="number" value={watchlist.max_year} />
        <Field label="Max km" name="max_mileage_km" type="number" value={watchlist.max_mileage_km} />
        <Field label="Min fiyat" name="min_price" type="number" value={watchlist.min_price} />
        <Field label="Max fiyat" name="max_price" type="number" value={watchlist.max_price} />
        <Field label="Hedef fiyat" name="target_price" type="number" value={watchlist.target_price} />
        <Field label="Para birimi" name="currency" value={watchlist.currency} />
        <Field label="Koltuk" name="seat_count" type="number" value={seatCount} />
        <label className="text-sm"><span className="mb-1 block text-ink-soft">Durum</span><select name="condition" defaultValue={condition ?? ""} className={inputClass}>
          <option value="">Farketmez</option><option value="new">Sıfır</option><option value="used_excellent">İkinci el - çok iyi</option><option value="used_good">İkinci el - iyi</option><option value="used_fair">İkinci el - normal</option><option value="damaged">Kazalı / hasarlı</option>
        </select></label>
        <label className="text-sm"><span className="mb-1 block text-ink-soft">Eşleşme modu</span><select name="search_mode" defaultValue={watchlist.search_mode ?? "discovery"} className={inputClass}><option value="discovery">Discovery · eksikleri doğrula</option><option value="strict">Strict · eksik alanı ele</option></select></label>
        <Field label="Tazelik (saat)" name="freshness_hours" type="number" value={watchlist.freshness_hours ?? 168} />
        <label className="text-sm"><span className="mb-1 block text-ink-soft">Sıralama</span><select name="sort_by" defaultValue={watchlist.sort_by ?? "relevance"} className={inputClass}><option value="relevance">Uygunluk</option><option value="newest">En yeni</option><option value="price">Fiyat</option><option value="mileage">Kilometre</option><option value="year">Model yılı</option></select></label>
        <label className="text-sm"><span className="mb-1 block text-ink-soft">Yön</span><select name="sort_direction" defaultValue={watchlist.sort_direction ?? "desc"} className={inputClass}><option value="desc">Azalan</option><option value="asc">Artan</option></select></label>
        <Field label="Sayfa boyutu" name="page_size" type="number" value={watchlist.page_size ?? 25} />
      </div>

      <DetailedVehicleFilters values={detailValuesFromWatchlist(watchlist)} />

      <details open className="mt-4 rounded-lg border border-line-soft bg-surface-sunken/40 p-4">
        <summary className="cursor-pointer text-sm font-semibold text-brand">Ticari alım profili</summary>
        <div className="mt-4 grid gap-3 md:grid-cols-4">
          <Field label="Hedef ülke kodu" name="destination_country_code" value={watchlist.destination_country_code ?? ""} />
          <Field label="Sabit ek maliyet (€)" name="estimated_fixed_costs" type="number" value={watchlist.estimated_fixed_costs ?? 0} />
          <Field label="Aylık bekleme maliyeti (€)" name="monthly_holding_cost" type="number" value={watchlist.monthly_holding_cost ?? 0} />
          <Field label="Maliyet rezervi (%)" name="cost_reserve_percent" type="number" value={watchlist.cost_reserve_percent ?? 10} />
          <Field label="Satış indirimi (%)" name="conservative_sale_discount_percent" type="number" value={watchlist.conservative_sale_discount_percent ?? 5} />
          <Field label="Minimum net kâr (€)" name="min_net_profit" type="number" value={watchlist.min_net_profit ?? 3000} />
          <Field label="Minimum net marj (%)" name="min_net_margin_percent" type="number" value={watchlist.min_net_margin_percent ?? 12} />
          <Field label="Maksimum stok günü" name="max_inventory_days" type="number" value={watchlist.max_inventory_days ?? 45} />
          <Field label="Anlık alarm skor eşiği" name="instant_alert_score" type="number" value={watchlist.instant_alert_score ?? 85} />
        </div>
      </details>

      <div className="mt-3 grid gap-3 md:grid-cols-3">
        <Field label="Anahtar kelimeler" name="keywords" value={watchlist.keywords.join(", ")} />
        <Field label="Olmazsa olmaz" name="must_have_keywords" value={watchlist.must_have_keywords.filter((keyword) => !keyword.startsWith("__vehigo_")).join(", ")} />
        <Field label="Hariç kelimeler" name="excluded_keywords" value={watchlist.excluded_keywords.join(", ")} />
      </div>

      <fieldset className="mt-4 rounded-md border border-line p-3 text-sm">
        <div className="flex items-center justify-between gap-3"><legend className="font-medium text-ink">Arama kaynakları</legend><div className="flex gap-2 text-xs"><button type="button" onClick={() => setSelectedSources(new Set(enabledSources.map((source) => source.key)))} className="text-brand hover:underline">Hepsini seç</button><button type="button" onClick={() => setSelectedSources(new Set())} className="text-ink-faint hover:text-ink">Temizle</button></div></div>
        <div className="mt-3 flex max-h-44 flex-wrap gap-3 overflow-y-auto">
          {enabledSources.map((source) => <label key={source.key} className="inline-flex items-center gap-2 text-xs text-ink"><input type="checkbox" name="source_keys" value={source.key} checked={selectedSources.has(source.key)} onChange={(event) => toggleSource(source.key, event.target.checked)} />{source.key === "brave_web" ? "Avrupa Deep Search" : source.name}</label>)}
        </div>
        <p className="mt-2 text-xs text-ink-faint">{selectedSources.size}/{enabledSources.length} kaynak seçili</p>
      </fieldset>

      <div className="mt-4 flex items-center gap-3"><button type="submit" disabled={pending} className="min-h-11 rounded-md bg-brand px-4 text-sm font-medium text-white hover:bg-brand-ink disabled:opacity-50">{pending ? "Kaydediliyor..." : "Değişiklikleri kaydet"}</button><button type="button" onClick={() => setOpen(false)} className="min-h-11 rounded-md border border-line px-4 text-sm text-ink-soft">İptal</button></div>
      {state.error ? <p role="alert" className="mt-2 text-sm text-danger">{state.error}</p> : null}
      {state.ok ? <p aria-live="polite" className="mt-2 text-sm text-success">{state.ok}</p> : null}
    </form>
  );
}

const inputClass = "min-h-11 w-full rounded-md border border-line bg-surface px-3 py-2 text-ink focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15";
function Field({ label, name, type = "text", required, value }: { label: string; name: string; type?: string; required?: boolean; value: string | number | null }) {
  return <label className="text-sm"><span className="mb-1 block text-ink-soft">{label}</span><input className={inputClass} name={name} type={type} required={required} defaultValue={value ?? ""} /></label>;
}

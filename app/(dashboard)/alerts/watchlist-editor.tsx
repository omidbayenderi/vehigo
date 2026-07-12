"use client";

import { useActionState, useState, useTransition } from "react";
import { Pencil, Trash2, X } from "lucide-react";
import type { Database, VehicleCondition } from "@/lib/supabase/types";
import { deleteWatchlistAction, editWatchlistAction, type FormState } from "./actions";
import DetailedVehicleFilters, { detailValuesFromKeywords } from "./detailed-vehicle-filters";

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

      <div className="grid gap-3 md:grid-cols-3">
        <Field label="Alarm adı" name="name" required value={watchlist.name} />
        <Field label="Ülke" name="country" value={watchlist.country} />
        <Field label="Şehir" name="city" value={watchlist.city} />
        <Field label="Marka" name="brand" value={watchlist.brand} />
        <Field label="Model" name="model" value={watchlist.model} />
        <label className="text-sm"><span className="mb-1 block text-ink-soft">Araç tipi</span><select name="vehicle_type" defaultValue={watchlist.vehicle_type ?? ""} className={inputClass}>
          <option value="">Farketmez</option><option value="car">Otomobil</option><option value="van">Hafif ticari / Van</option><option value="truck">Kamyon</option><option value="trailer">Dorse</option><option value="construction">İş makinesi</option><option value="spare_part">Yedek parça</option><option value="bus">Otobüs</option><option value="other">Diğer</option>
        </select></label>
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
      </div>

      <DetailedVehicleFilters values={detailValuesFromKeywords(watchlist.must_have_keywords)} />

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

"use client";

import { useState } from "react";
import { CheckCircle2, Search, Sparkles } from "lucide-react";
import type { SearchPlanV1 } from "@/lib/search/search-plan";

export default function NaturalLanguagePlanner({ defaultQuery, defaultPlan }: { defaultQuery?: string | null; defaultPlan?: unknown }) {
  const [query, setQuery] = useState(defaultQuery ?? "");
  const [plan, setPlan] = useState<SearchPlanV1 | null>(isPlan(defaultPlan) ? defaultPlan : null);
  const [previewed, setPreviewed] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const preview = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/search/plan", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ query }),
      });
      const body = await response.json() as { plan?: SearchPlanV1; error?: string };
      if (!response.ok || !body.plan) throw new Error(body.error ?? "Arama planı oluşturulamadı.");
      setPlan(body.plan);
      setPreviewed(true);
      setConfirmed(false);
    } catch (previewError) {
      setPlan(null);
      setError(previewError instanceof Error ? previewError.message : "Arama planı oluşturulamadı.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="mb-5 rounded-lg border border-brand/25 bg-brand/[0.035] p-4" aria-labelledby="natural-search-title">
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-md bg-brand/10 text-brand"><Sparkles size={18} aria-hidden="true" /></span>
        <div className="min-w-0 flex-1">
          <h3 id="natural-search-title" className="text-sm font-semibold text-ink">Doğal dille arama planı</h3>
          <p className="mt-1 text-xs leading-5 text-ink-faint">Aracı günlük dille tarif edin. Vehigo bunu yapılandırılmış filtrelere çevirir; kaydetmeden önce planı görüp onaylarsınız.</p>
        </div>
      </div>
      <label className="mt-3 block text-sm">
        <span className="mb-1 block text-ink-soft">Arama tarifi</span>
        <textarea
          name="natural_language_query"
          value={query}
          onChange={(event) => { setQuery(event.target.value); setPlan(null); setPreviewed(false); setConfirmed(false); setError(null); }}
          rows={3}
          maxLength={1000}
          placeholder="Almanya ve Hollanda'da 2021 sonrası, 80 bin km altında otomatik Volkswagen Golf; bilgisi eksik ilanları da göster"
          className="w-full resize-y rounded-md border border-line bg-surface px-3 py-2 text-base text-ink focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15"
        />
      </label>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button type="button" onClick={preview} disabled={loading || query.trim().length < 3} className="inline-flex min-h-11 items-center gap-2 rounded-md border border-brand/30 bg-surface px-4 text-sm font-medium text-brand transition-colors hover:bg-brand/5 disabled:cursor-not-allowed disabled:opacity-50">
          <Search size={16} aria-hidden="true" /> {loading ? "Planlanıyor..." : "Planı önizle"}
        </button>
        {plan && previewed && !confirmed ? <button type="button" onClick={() => setConfirmed(true)} className="inline-flex min-h-11 items-center gap-2 rounded-md bg-brand px-4 text-sm font-medium text-white hover:bg-brand-ink"><CheckCircle2 size={16} aria-hidden="true" /> Bu planı kullan</button> : null}
        {plan && !previewed ? <span className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-soft"><CheckCircle2 size={16} aria-hidden="true" /> Kayıtlı plan · değiştirilmedi</span> : null}
        {plan && confirmed ? <span className="inline-flex items-center gap-1.5 text-sm font-medium text-success"><CheckCircle2 size={16} aria-hidden="true" /> Plan onaylandı · güven %{Math.round(plan.confidence * 100)}</span> : null}
      </div>
      {error ? <p role="alert" className="mt-3 text-sm text-danger">{error}</p> : null}
      {plan ? (
        <div className="mt-3 rounded-md border border-line-soft bg-surface p-3" aria-live="polite">
          <p className="text-xs font-medium text-ink">Onaylanan yapılandırılmış plan</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {Object.entries(plan.filters).map(([key, value]) => (
              <span key={key} className="rounded-full border border-line bg-paper px-2.5 py-1 text-xs text-ink-soft">{planLabel(key)}: {Array.isArray(value) ? value.join(", ") : String(value)}</span>
            ))}
          </div>
          {plan.warnings.length > 0 ? <p className="mt-2 text-xs text-warning">Kontrol edin: {plan.warnings.join(" ")}</p> : null}
          {confirmed ? <input type="hidden" name="confirmed_search_plan" value={JSON.stringify(plan)} /> : null}
        </div>
      ) : null}
      {defaultQuery ? <input type="hidden" name="original_natural_language_query" value={defaultQuery} /> : null}
    </section>
  );
}

function isPlan(value: unknown): value is SearchPlanV1 {
  return Boolean(value && typeof value === "object" && (value as { version?: unknown }).version === 1);
}

function planLabel(key: string) {
  return ({ brand: "Marka", model: "Model", vehicle_type: "Araç", country_codes: "Ülkeler", region_preset: "Bölge", min_year: "Min yıl", max_year: "Max yıl", max_price: "Max fiyat", max_mileage_km: "Max km", fuel_type: "Yakıt", transmission: "Şanzıman", body_type: "Kasa", drive_type: "Çekiş", seller_type: "Satıcı", search_mode: "Mod" } as Record<string, string>)[key] ?? key;
}

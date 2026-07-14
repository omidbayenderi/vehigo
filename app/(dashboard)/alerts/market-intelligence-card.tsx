"use client";

import { useActionState } from "react";
import { Bot, RefreshCw, ShieldAlert } from "lucide-react";
import type { IntelligenceSnapshot } from "@/lib/services/market-intelligence";
import { pillClasses, type PillTone } from "@/lib/ui";
import { analyzeListingIntelligenceAction, type FormState } from "./actions";

const initialState: FormState = {};

export default function MarketIntelligenceCard({ listingId, snapshot }: { listingId: string; snapshot?: IntelligenceSnapshot }) {
  const [analysisState, analysisAction, analysisPending] = useActionState(analyzeListingIntelligenceAction.bind(null, listingId, false), initialState);
  const [aiState, aiAction, aiPending] = useActionState(analyzeListingIntelligenceAction.bind(null, listingId, true), initialState);
  const distribution = readDistribution(snapshot?.distribution);
  const signals = readSignals(snapshot?.risk_signals);

  return (
    <section className="mt-4 rounded-lg border border-line-soft bg-surface-sunken/40 p-4" aria-label="Piyasa istihbaratı">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="text-sm font-semibold text-ink">Piyasa istihbaratı</h4>
            {snapshot ? <span className={pillClasses(qualityTone(snapshot.sample_quality))}>Örneklem: {qualityLabel(snapshot.sample_quality)}</span> : <span className={pillClasses("neutral")}>Henüz hesaplanmadı</span>}
            {snapshot ? <span className={pillClasses(riskTone(snapshot.risk_level))}>Risk {snapshot.risk_score}/100 · {riskLabel(snapshot.risk_level)}</span> : null}
          </div>
          <p className="mt-1 text-xs text-ink-faint">
            {snapshot ? `${snapshot.comparable_count} tekil benzer ilan · ${snapshot.source_count} bağımsız kaynak · güven %${Math.round(snapshot.confidence * 100)}` : "Kanıtlanabilir benzer ilan seçimi, fiyat dağılımı ve risk sinyalleri üretir."}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <form action={analysisAction}>
            <button type="submit" disabled={analysisPending || aiPending} className="inline-flex min-h-11 items-center gap-2 rounded-md border border-line bg-surface px-3 text-xs font-medium text-ink-soft hover:border-brand hover:text-brand disabled:opacity-50">
              <RefreshCw className={`h-4 w-4 ${analysisPending ? "animate-spin" : ""}`} aria-hidden="true" />
              {analysisPending ? "Hesaplanıyor…" : snapshot ? "Yeniden hesapla" : "Analiz et"}
            </button>
          </form>
          <form action={aiAction}>
            <button type="submit" disabled={analysisPending || aiPending} className="inline-flex min-h-11 items-center gap-2 rounded-md bg-brand px-3 text-xs font-medium text-white hover:brightness-95 disabled:opacity-50">
              <Bot className="h-4 w-4" aria-hidden="true" />
              {aiPending ? "İnceleniyor…" : "AI kanıt incelemesi"}
            </button>
          </form>
        </div>
      </div>

      {snapshot && distribution ? (
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <Metric label="Pazar medyanı" value={money(distribution.median)} />
          <Metric label="Orta fiyat aralığı" value={`${money(distribution.q1)} – ${money(distribution.q3)}`} />
          <Metric
            label="Pazar konumu"
            value={snapshot.claim_eligible && snapshot.underpricing_percent !== null ? `%${Math.abs(snapshot.underpricing_percent).toFixed(1)} ${snapshot.underpricing_percent >= 0 ? "medyan altı" : "medyan üstü"}` : "İddia için veri yetersiz"}
          />
        </div>
      ) : null}

      {snapshot && !snapshot.claim_eligible ? (
        <p className="mt-3 flex gap-2 rounded-md border border-warning/20 bg-warning-wash px-3 py-2 text-xs text-warning">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          Bu örneklem ticari fiyat iddiası üretmek için yeterli değil. Ham istatistikler yalnız bağlam amacıyla gösterilir.
        </p>
      ) : null}

      {signals.length > 0 ? (
        <details className="mt-3 text-xs">
          <summary className="cursor-pointer font-medium text-ink-soft">Risk kanıtları ({signals.length})</summary>
          <ul className="mt-2 space-y-1.5 text-ink-faint">
            {signals.map((signal, index) => <li key={`${signal.code}-${index}`}><span className="font-medium text-ink-soft">{signal.title}:</span> {signal.evidence}</li>)}
          </ul>
        </details>
      ) : null}
      <p className="mt-3 text-[11px] text-ink-faint">Hesap sürümü {snapshot?.analysis_version ?? "market-v1"}. Sonuçlar ekspertiz, hukuki kontrol veya satıcı güvenilirlik beyanı değildir.</p>
      {analysisState.error || aiState.error ? <p role="alert" className="mt-2 text-xs text-danger">{analysisState.error ?? aiState.error}</p> : null}
      {analysisState.ok || aiState.ok ? <p role="status" className="mt-2 text-xs text-success">{analysisState.ok ?? aiState.ok}</p> : null}
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-md border border-line-soft bg-surface p-3"><p className="text-[11px] text-ink-faint">{label}</p><p className="mt-1 text-sm font-semibold tabular-nums text-ink">{value}</p></div>;
}

function readDistribution(value: IntelligenceSnapshot["distribution"] | undefined) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const median = value.median;
  const q1 = value.q1;
  const q3 = value.q3;
  return typeof median === "number" && typeof q1 === "number" && typeof q3 === "number" ? { median, q1, q3 } : null;
}

function readSignals(value: IntelligenceSnapshot["risk_signals"] | undefined) {
  if (!Array.isArray(value)) return [];
  return value.flatMap((signal) => signal && typeof signal === "object" && !Array.isArray(signal) && typeof signal.code === "string" && typeof signal.title === "string" && typeof signal.evidence === "string" ? [{ code: signal.code, title: signal.title, evidence: signal.evidence }] : []);
}

function money(value: number) { return `${value.toLocaleString("tr-TR", { maximumFractionDigits: 0 })} EUR`; }
function qualityLabel(value: IntelligenceSnapshot["sample_quality"]) { return value === "high" ? "yüksek" : value === "medium" ? "orta" : value === "low" ? "düşük" : "yetersiz"; }
function riskLabel(value: IntelligenceSnapshot["risk_level"]) { return value === "critical" ? "kritik" : value === "high" ? "yüksek" : value === "medium" ? "orta" : value === "low" ? "düşük" : "bilinmiyor"; }
function qualityTone(value: IntelligenceSnapshot["sample_quality"]): PillTone { return value === "high" ? "success" : value === "medium" ? "brand" : value === "low" ? "warning" : "danger"; }
function riskTone(value: IntelligenceSnapshot["risk_level"]): PillTone { return value === "critical" || value === "high" ? "danger" : value === "medium" ? "warning" : value === "low" ? "success" : "neutral"; }

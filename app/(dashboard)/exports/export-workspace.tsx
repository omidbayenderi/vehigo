"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Calculator, CheckCircle2, Plus, RefreshCw, Route, Scale, WalletCards } from "lucide-react";
import type { Database, Json } from "@/lib/supabase/types";
import type { ExportScenarioListItem } from "@/lib/services/export-scenarios";
import { cardClass, pillClasses, type PillTone } from "@/lib/ui";

type RuleSet = Database["public"]["Tables"]["export_rule_sets"]["Row"];
type Rate = Database["public"]["Tables"]["exchange_rate_snapshots"]["Row"];
type Vehicle = Pick<Database["public"]["Tables"]["vehicles"]["Row"], "id" | "brand" | "model" | "year" | "price" | "currency" | "seller_country" | "vehicle_type">;
type Offer = Pick<Database["public"]["Tables"]["offers"]["Row"], "id" | "vehicle_id" | "base_vehicle_price" | "currency" | "created_at">;
type ScenarioDocument = Database["public"]["Tables"]["export_scenario_documents"]["Row"];
type DocumentReviewPayload = { status: ScenarioDocument["status"]; notes?: string; evidence_reference?: string; document_issued_at?: string; valid_until?: string };

export default function ExportWorkspace({ scenarios, ruleSets, vehicles, offers, rates, isOwner }: { scenarios: ExportScenarioListItem[]; ruleSets: RuleSet[]; vehicles: Vehicle[]; offers: Offer[]; rates: Rate[]; isOwner: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ tone: "error" | "success"; text: string } | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const compared = scenarios.filter((scenario) => selected.includes(scenario.id)).slice(0, 3);

  const run = (operation: () => Promise<void>) => startTransition(async () => {
    setMessage(null);
    try { await operation(); setMessage({ tone: "success", text: "İşlem tamamlandı." }); router.refresh(); }
    catch (error) { setMessage({ tone: "error", text: error instanceof Error ? error.message : "İşlem tamamlanamadı." }); }
  });

  return (
    <div className="space-y-6">
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,.65fr)]">
        <ScenarioForm vehicles={vehicles} ruleSets={ruleSets} pending={pending} onSubmit={(payload) => run(() => api("/api/exports/scenarios", { method: "POST", body: JSON.stringify(payload) }))} />
        <div className="space-y-4">
          <LegacyOfferImporter offers={offers} pending={pending} onImport={(id) => run(() => api(`/api/exports/legacy-offers/${id}`, { method: "POST" }))} />
          {isOwner ? <RateForm rates={rates} pending={pending} onSubmit={(payload) => run(() => api("/api/exports/exchange-rates", { method: "POST", body: JSON.stringify(payload) }))} /> : null}
          {isOwner ? <RuleSetForm pending={pending} onSubmit={(payload) => run(() => api("/api/exports/rule-sets", { method: "POST", body: JSON.stringify(payload) }))} /> : null}
        </div>
      </div>

      {message ? <p role={message.tone === "error" ? "alert" : "status"} className={`rounded-md px-4 py-3 text-sm ${message.tone === "error" ? "bg-danger-wash text-danger" : "bg-success-wash text-success"}`}>{message.text}</p> : null}

      {compared.length >= 2 ? <ComparisonTable scenarios={compared} /> : null}

      <section className={cardClass}>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line-soft px-5 py-4">
          <div><h2 className="text-sm font-semibold text-ink">Senaryolar</h2><p className="mt-1 text-xs text-ink-faint">Karşılaştırmak için en fazla üç senaryo seçin.</p></div>
          <span className={pillClasses(selected.length >= 2 ? "brand" : "neutral")}>{selected.length}/3 seçili</span>
        </div>
        <div className="divide-y divide-line-soft">
          {scenarios.map((scenario) => <ScenarioCard key={scenario.id} scenario={scenario} selected={selected.includes(scenario.id)} disabled={!selected.includes(scenario.id) && selected.length >= 3} pending={pending} onToggle={() => setSelected((current) => current.includes(scenario.id) ? current.filter((id) => id !== scenario.id) : [...current, scenario.id])} onCalculate={() => run(() => api(`/api/exports/scenarios/${scenario.id}/calculate`, { method: "POST" }))} onApprove={() => run(() => api(`/api/exports/scenarios/${scenario.id}/approve`, { method: "POST", body: "{}" }))} onDocument={(documentId, payload) => run(() => api(`/api/exports/scenarios/${scenario.id}/documents/${documentId}`, { method: "PATCH", body: JSON.stringify(payload) }))} />)}
          {scenarios.length === 0 ? <div className="px-5 py-12 text-center"><Route className="mx-auto h-8 w-8 text-ink-faint" aria-hidden="true" /><p className="mt-3 font-medium text-ink">Henüz ihracat senaryosu yok</p><p className="mt-1 text-sm text-ink-faint">Yukarıdaki formdan ilk rotayı ve maliyet varsayımlarını kaydedin.</p></div> : null}
        </div>
      </section>
    </div>
  );
}

function ScenarioForm({ vehicles, ruleSets, pending, onSubmit }: { vehicles: Vehicle[]; ruleSets: RuleSet[]; pending: boolean; onSubmit: (payload: Record<string, unknown>) => void }) {
  const [vehicleId, setVehicleId] = useState("");
  const vehicle = vehicles.find((item) => item.id === vehicleId);
  return <form className={`${cardClass} p-5`} onSubmit={(event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const currency = String(data.get("calculation_currency") || "EUR").toUpperCase();
    const costs = [
      ["transport", "Nakliye", "logistics", data.get("transport_cost")], ["insurance", "Sigorta", "insurance", data.get("insurance_cost")], ["customs", "Gümrük", "customs", data.get("customs_cost")], ["service", "Hizmet", "service", data.get("service_cost")],
    ].flatMap(([code, label, category, raw]) => Number(raw) > 0 ? [{ code, label, category, amount: Number(raw), currency, evidence: String(data.get(`${code}_evidence`) || "") || undefined }] : []);
    onSubmit({ name: data.get("name"), vehicle_id: vehicleId || undefined, origin_country_code: String(data.get("origin_country_code") || "").toUpperCase(), destination_country_code: String(data.get("destination_country_code") || "").toUpperCase(), transport_mode: data.get("transport_mode"), vehicle_category: data.get("vehicle_category"), buyer_profile: data.get("buyer_profile"), calculation_currency: currency, vehicle_price: Number(data.get("vehicle_price")), vehicle_currency: String(data.get("vehicle_currency") || currency).toUpperCase(), rule_set_id: data.get("rule_set_id") || undefined, manual_costs: costs, assumptions: { createdFrom: "export_workspace_v1" } });
  }}>
    <div className="mb-4 flex items-center gap-2"><Calculator className="h-5 w-5 text-brand" aria-hidden="true" /><div><h2 className="font-semibold text-ink">Yeni maliyet senaryosu</h2><p className="text-xs text-ink-faint">Önce rota ve araç; sonra doğrulanabilir maliyet varsayımları.</p></div></div>
    <div key={vehicleId || "manual"} className="grid gap-4 md:grid-cols-2">
      <Field label="Senaryo adı" name="name" required />
      <label className="block text-sm font-medium text-ink-soft">Araç (isteğe bağlı)<select name="vehicle_id" value={vehicleId} onChange={(event) => setVehicleId(event.target.value)} className={inputClass}><option value="">Manuel fiyat</option>{vehicles.map((item) => <option key={item.id} value={item.id}>{[item.brand, item.model, item.year].filter(Boolean).join(" ")}</option>)}</select></label>
      <Field label="Çıkış ülkesi (ISO)" name="origin_country_code" defaultValue={countryGuess(vehicle?.seller_country) ?? "DE"} required maxLength={2} />
      <Field label="Hedef ülke (ISO)" name="destination_country_code" defaultValue="IR" required maxLength={2} />
      <Select label="Taşıma modu" name="transport_mode" options={[["road","Karayolu"],["rail","Demiryolu"],["sea","Denizyolu"],["air","Havayolu"],["multimodal","Çok modlu"]]} />
      <Field label="Araç kategorisi" name="vehicle_category" defaultValue={vehicle?.vehicle_type ?? "truck"} required />
      <Field label="Alıcı profili" name="buyer_profile" defaultValue="commercial_buyer" required />
      <label className="block text-sm font-medium text-ink-soft">Kural seti<select name="rule_set_id" className={inputClass}><option value="">Kural seti yok (onaylanamaz)</option>{ruleSets.map((item) => <option key={item.id} value={item.id}>{item.name} · v{item.version}</option>)}</select></label>
      <Field label="Araç fiyatı" name="vehicle_price" type="number" step="0.01" defaultValue={String(vehicle?.price ?? 0)} required />
      <Field label="Araç para birimi" name="vehicle_currency" defaultValue={vehicle?.currency ?? "EUR"} required maxLength={3} />
      <Field label="Hesap para birimi" name="calculation_currency" defaultValue="EUR" required maxLength={3} />
    </div>
    <details className="mt-4 rounded-md border border-line-soft p-4"><summary className="cursor-pointer text-sm font-medium text-ink">Manuel maliyet varsayımları</summary><p className="mt-1 text-xs text-ink-faint">Her tutara teklif, sözleşme veya kaynak referansı ekleyin.</p><div className="mt-3 grid gap-3 md:grid-cols-2">{[["transport","Nakliye"],["insurance","Sigorta"],["customs","Gümrük"],["service","Hizmet"]].map(([code,label]) => <div key={code} className="grid grid-cols-[120px_1fr] gap-2"><Field label={`${label} tutarı`} name={`${code}_cost`} type="number" step="0.01" defaultValue="0" /><Field label="Kanıt / referans" name={`${code}_evidence`} /></div>)}</div></details>
    <button disabled={pending} className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-md bg-brand px-4 text-sm font-semibold text-white hover:brightness-95 disabled:opacity-50"><Plus className="h-4 w-4" aria-hidden="true" />{pending ? "Kaydediliyor…" : "Senaryo oluştur"}</button>
  </form>;
}

function ScenarioCard({ scenario, selected, disabled, pending, onToggle, onCalculate, onApprove, onDocument }: { scenario: ExportScenarioListItem; selected: boolean; disabled: boolean; pending: boolean; onToggle: () => void; onCalculate: () => void; onApprove: () => void; onDocument: (id: string, payload: DocumentReviewPayload) => void }) {
  const totals = readObject(scenario.latestResult?.totals);
  const compliance = readObject(scenario.latestResult?.compliance);
  const lines = readArray(scenario.latestResult?.cost_lines);
  const sensitivity = readArray(scenario.latestResult?.sensitivity);
  const currency = typeof totals.currency === "string" ? totals.currency : scenario.calculation_currency;
  const landed = typeof totals.landedCost === "number" ? totals.landedCost : null;
  const maxLine = Math.max(1, ...lines.map((line) => typeof line.amount === "number" ? line.amount : 0));
  const documentsReady = scenario.documents.filter((document) => document.required).every((document) => document.status === "verified" || document.status === "not_applicable");
  return <article className="px-5 py-5">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div><div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold text-ink">{scenario.name}</h3><span className={pillClasses(approvalTone(scenario.approval_status))}>{approvalLabel(scenario.approval_status)}</span><span className={pillClasses("neutral")}>{scenario.origin_country_code} → {scenario.destination_country_code}</span></div><p className="mt-1 text-xs text-ink-faint">{scenario.transport_mode} · {scenario.vehicle_category} · {scenario.buyer_profile} · {scenario.latestResult ? `kanıt ${scenario.latestResult.evidence_hash.slice(0, 10)}` : "hesaplanmadı"}</p></div>
      <div className="flex flex-wrap gap-2"><button type="button" onClick={onToggle} disabled={disabled} aria-pressed={selected} className={`min-h-11 rounded-md border px-3 text-xs font-medium ${selected ? "border-brand bg-brand-wash text-brand" : "border-line bg-surface text-ink-soft"} disabled:opacity-40`}>{selected ? "Karşılaştırmadan çıkar" : "Karşılaştır"}</button><button type="button" onClick={onCalculate} disabled={pending} className="inline-flex min-h-11 items-center gap-2 rounded-md border border-line px-3 text-xs font-medium text-ink-soft hover:border-brand hover:text-brand disabled:opacity-50"><RefreshCw className={`h-4 w-4 ${pending ? "animate-spin" : ""}`} aria-hidden="true" />Hesapla</button><button type="button" onClick={onApprove} disabled={pending || !scenario.latestResult || compliance.calculationComplete !== true || !documentsReady} title={!documentsReady ? "Zorunlu belgeler tamamlanmadan onay verilemez." : undefined} className="inline-flex min-h-11 items-center gap-2 rounded-md bg-success px-3 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"><CheckCircle2 className="h-4 w-4" aria-hidden="true" />Onayla</button></div>
    </div>
    {landed !== null ? <div className="mt-4 grid gap-4 xl:grid-cols-[260px_minmax(0,1fr)]"><div className="rounded-md border border-line-soft bg-paper p-4"><p className="text-xs text-ink-faint">Toplam landed cost</p><p className="mt-1 text-2xl font-semibold tabular-nums text-ink">{money(landed, currency)}</p><p className="mt-2 text-xs text-ink-faint">Hesap sürümü {scenario.latestResult?.calculation_version}</p></div><div className="space-y-2" aria-label="Maliyet kırılımı">{lines.slice(0, 12).map((line, index) => { const amount = typeof line.amount === "number" ? line.amount : 0; return <div key={`${String(line.code)}-${index}`} className="grid grid-cols-[minmax(110px,180px)_1fr_auto] items-center gap-3 text-xs"><span className="truncate text-ink-soft">{String(line.label ?? line.code)}</span><div className="h-2 overflow-hidden rounded-full bg-surface-sunken"><div className="h-full rounded-full bg-brand" style={{ width: `${Math.max(2, amount / maxLine * 100)}%` }} /></div><span className="tabular-nums text-ink">{money(amount, currency)}</span></div>; })}</div></div> : null}
    {sensitivity.length ? <details className="mt-4"><summary className="cursor-pointer text-sm font-medium text-ink">Hassasiyet ve stres senaryoları</summary><div className="mt-2 overflow-x-auto"><table className="w-full min-w-[560px] text-sm"><thead className="text-left text-xs text-ink-faint"><tr><th className="py-2">Varsayım</th><th>Toplam</th><th>Fark</th><th>Değişim</th></tr></thead><tbody className="divide-y divide-line-soft">{sensitivity.map((row, index) => <tr key={`${String(row.code)}-${index}`}><td className="py-2 text-ink-soft">{String(row.label)}</td><td className="tabular-nums text-ink">{money(Number(row.landedCost), currency)}</td><td className="tabular-nums text-warning">+{money(Number(row.delta), currency)}</td><td className="tabular-nums text-warning">%{Number(row.deltaPercent).toLocaleString("tr-TR")}</td></tr>)}</tbody></table></div></details> : null}
    {scenario.documents.length ? <details className="mt-4"><summary className="cursor-pointer text-sm font-medium text-ink">Belge kontrolü ({scenario.documents.filter((item) => item.status === "verified").length}/{scenario.documents.length})</summary><p className="mt-2 text-xs text-ink-faint">Nihai doğrulama için kanıt URL’si veya belge numarası zorunludur ve karar izi hash’lenir.</p><div className="mt-3 grid gap-2 md:grid-cols-2">{scenario.documents.map((document) => <DocumentReview key={document.id} document={document} pending={pending} onSubmit={(payload) => onDocument(document.id, payload)} />)}</div></details> : null}
    {Array.isArray(compliance.blockers) && compliance.blockers.length ? <p className="mt-3 rounded-md bg-danger-wash px-3 py-2 text-xs text-danger"><Scale className="mr-2 inline h-4 w-4" aria-hidden="true" />{compliance.blockers.map(String).join(" · ")}</p> : null}
  </article>;
}

function DocumentReview({ document, pending, onSubmit }: { document: ScenarioDocument; pending: boolean; onSubmit: (payload: DocumentReviewPayload) => void }) {
  const [status, setStatus] = useState<ScenarioDocument["status"]>(document.status);
  const evidenceRequired = status === "verified";
  const notesRequired = status === "rejected" || status === "not_applicable";
  return <details className="rounded-md border border-line-soft bg-surface p-3">
    <summary className="cursor-pointer list-none">
      <div className="flex min-h-11 items-center justify-between gap-3">
        <div><p className="text-sm font-medium text-ink">{document.label}{document.required ? <span className="ml-1 text-danger" aria-label="zorunlu">*</span> : null}</p><p className="mt-1 text-xs text-ink-faint">{documentStatus(document.status)}{document.evidence_sha256 ? ` · kanıt ${document.evidence_sha256.slice(0, 10)}` : ""}</p></div>
        <span className={pillClasses(document.status === "verified" ? "success" : document.status === "rejected" ? "danger" : document.status === "not_applicable" ? "neutral" : "warning")}>İncele</span>
      </div>
    </summary>
    <form className="mt-3 grid gap-3 border-t border-line-soft pt-3" onSubmit={(event) => {
      event.preventDefault();
      const data = new FormData(event.currentTarget);
      onSubmit({
        status,
        evidence_reference: String(data.get("evidence_reference") ?? "").trim() || undefined,
        notes: String(data.get("notes") ?? "").trim() || undefined,
        document_issued_at: String(data.get("document_issued_at") ?? "") || undefined,
        valid_until: String(data.get("valid_until") ?? "") || undefined,
      });
    }}>
      <label className="block text-xs font-medium text-ink-soft">İnceleme kararı<select value={status} onChange={(event) => setStatus(event.target.value as ScenarioDocument["status"])} className={inputClass}><option value="pending">Bekliyor</option><option value="received">Alındı</option><option value="verified">Doğrulandı</option><option value="rejected">Reddedildi</option><option value="not_applicable">Uygulanamaz</option></select></label>
      <label className="block text-xs font-medium text-ink-soft">Kanıt URL’si veya belge numarası{evidenceRequired ? <span className="ml-1 text-danger">*</span> : null}<input name="evidence_reference" defaultValue={document.evidence_reference ?? ""} required={evidenceRequired} minLength={evidenceRequired ? 3 : undefined} className={inputClass} /><span className="mt-1 block font-normal text-ink-faint">Dosya yolu, resmî kayıt URL’si, MRN veya doğrulanabilir referans.</span></label>
      <div className="grid grid-cols-2 gap-2"><Field label="Belge tarihi" name="document_issued_at" type="date" defaultValue={document.document_issued_at ?? undefined} /><Field label="Geçerli olduğu tarih" name="valid_until" type="date" defaultValue={document.valid_until ?? undefined} /></div>
      <label className="block text-xs font-medium text-ink-soft">İnceleme notu{notesRequired ? <span className="ml-1 text-danger">*</span> : null}<textarea name="notes" defaultValue={document.notes ?? ""} required={notesRequired} minLength={notesRequired ? 3 : undefined} maxLength={2000} rows={3} className={`${inputClass} py-2`} /></label>
      <button disabled={pending} className="min-h-11 rounded-md bg-brand px-3 text-sm font-semibold text-white transition-colors hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50">{pending ? "Kaydediliyor…" : "İnceleme kararını kaydet"}</button>
    </form>
  </details>;
}

function ComparisonTable({ scenarios }: { scenarios: ExportScenarioListItem[] }) { return <section className={cardClass}><div className="border-b border-line-soft px-5 py-4"><h2 className="text-sm font-semibold text-ink">Senaryo karşılaştırması</h2><p className="mt-1 text-xs text-ink-faint">Kesin değerler tabloyla sunulur; renk tek başına anlam taşımaz.</p></div><div className="overflow-x-auto"><table className="w-full min-w-[700px] text-sm"><thead className="bg-paper text-left text-xs text-ink-faint"><tr><th className="px-4 py-3">Ölçüt</th>{scenarios.map((scenario) => <th key={scenario.id} className="px-4 py-3">{scenario.name}</th>)}</tr></thead><tbody className="divide-y divide-line-soft">{[["Rota", (s: ExportScenarioListItem) => `${s.origin_country_code} → ${s.destination_country_code}`],["Toplam", (s: ExportScenarioListItem) => { const t=readObject(s.latestResult?.totals); return typeof t.landedCost === "number" ? money(t.landedCost, String(t.currency ?? s.calculation_currency)) : "Hesaplanmadı"; }],["Kural/kanıt", (s: ExportScenarioListItem) => s.latestResult ? `${s.latestResult.calculation_version} · ${s.latestResult.evidence_hash.slice(0,10)}` : "—"],["Onay", (s: ExportScenarioListItem) => approvalLabel(s.approval_status)]].map(([label, getter]) => <tr key={String(label)}><th className="px-4 py-3 text-left text-xs font-medium text-ink-faint">{String(label)}</th>{scenarios.map((scenario) => <td key={scenario.id} className="px-4 py-3 font-medium text-ink">{(getter as (s: ExportScenarioListItem) => string)(scenario)}</td>)}</tr>)}</tbody></table></div></section>; }

function LegacyOfferImporter({ offers, pending, onImport }: { offers: Offer[]; pending: boolean; onImport: (id: string) => void }) { const [id,setId]=useState(""); return <div className={`${cardClass} p-5`}><div className="flex items-center gap-2"><WalletCards className="h-5 w-5 text-brand" aria-hidden="true" /><h2 className="font-semibold text-ink">Eski İran teklifini dönüştür</h2></div><p className="mt-1 text-xs text-ink-faint">Eski özel alanlar genel ve izlenebilir maliyet kalemlerine kopyalanır.</p><select value={id} onChange={(e)=>setId(e.target.value)} className={`${inputClass} mt-4`}><option value="">Teklif seç</option>{offers.map((offer)=><option key={offer.id} value={offer.id}>{offer.id.slice(0,8)} · {offer.base_vehicle_price?.toLocaleString("tr-TR")} {offer.currency}</option>)}</select><button type="button" onClick={()=>id&&onImport(id)} disabled={!id||pending} className="mt-3 min-h-11 rounded-md border border-brand px-3 text-sm font-medium text-brand disabled:opacity-40">Senaryoya dönüştür</button></div>; }

function RateForm({ rates, pending, onSubmit }: { rates: Rate[]; pending: boolean; onSubmit: (payload: Record<string, unknown>) => void }) { return <details className={`${cardClass} p-5`}><summary className="cursor-pointer font-semibold text-ink">Kur snapshot’ı ekle</summary><p className="mt-1 text-xs text-ink-faint">Kur oranı, sağlayıcı ve gözlem zamanı birlikte dondurulur.</p><form className="mt-4 grid grid-cols-2 gap-3" onSubmit={(e)=>{e.preventDefault();const d=new FormData(e.currentTarget);onSubmit({base_currency:String(d.get("base_currency")).toUpperCase(),quote_currency:String(d.get("quote_currency")).toUpperCase(),rate:Number(d.get("rate")),provider:d.get("provider"),source_reference:d.get("source_reference"),observed_at:new Date(String(d.get("observed_at"))).toISOString()});}}><Field label="Baz" name="base_currency" defaultValue="EUR" required maxLength={3}/><Field label="Karşıt" name="quote_currency" defaultValue="USD" required maxLength={3}/><Field label="Oran" name="rate" type="number" step="0.00000001" required/><Field label="Sağlayıcı" name="provider" required/><Field label="Kaynak URL" name="source_reference" type="url"/><Field label="Gözlem zamanı" name="observed_at" type="datetime-local" required/><button disabled={pending} className="col-span-2 min-h-11 rounded-md bg-brand px-3 text-sm font-semibold text-white disabled:opacity-50">Kur snapshot’ını kaydet</button></form>{rates[0]?<p className="mt-3 text-xs text-ink-faint">Son kayıt: {rates[0].base_currency}/{rates[0].quote_currency} · {rates[0].rate} · {rates[0].provider}</p>:null}</details>; }

function RuleSetForm({ pending, onSubmit }: { pending: boolean; onSubmit: (payload: Record<string, unknown>) => void }) { return <details className={`${cardClass} p-5`}><summary className="cursor-pointer font-semibold text-ink">Kural seti oluştur</summary><p className="mt-1 text-xs text-ink-faint">Aktif set en az bir resmi/uzman kaynak referansı ister. Oranları doğrulamadan girmeyin.</p><form className="mt-4 grid grid-cols-2 gap-3" onSubmit={(event)=>{event.preventDefault();const data=new FormData(event.currentTarget);const documentLabels=String(data.get("documents")??"").split(",").map((item)=>item.trim()).filter(Boolean);const calculationType=String(data.get("calculation_type"));const ruleLabel=String(data.get("rule_label")??"").trim();const rules=ruleLabel?[{rule_code:String(data.get("rule_code")),label:ruleLabel,category:data.get("rule_category"),calculation_type:calculationType,base_key:calculationType==="percentage"?data.get("base_key"):undefined,amount:calculationType==="fixed"?Number(data.get("rule_value")):undefined,rate_percent:calculationType==="percentage"?Number(data.get("rule_value")):undefined,currency:calculationType==="fixed"?String(data.get("rule_currency")).toUpperCase():undefined,conditions:{},evidence_required:true,sort_order:0}]:[];onSubmit({code:data.get("code"),name:data.get("name"),version:Number(data.get("version")),activate:true,origin_country_code:String(data.get("origin_country_code")||"").toUpperCase()||undefined,destination_country_code:String(data.get("destination_country_code")||"").toUpperCase()||undefined,effective_from:data.get("effective_from")||undefined,source_references:[{label:data.get("source_label"),url:data.get("source_url"),checked_at:new Date().toISOString()}],required_documents:documentLabels.map((label,index)=>({code:`document_${index+1}`,label,required:true})),assumptions:{enteredByOwner:true},rules});}}><Field label="Kod" name="code" required/><Field label="Ad" name="name" required/><Field label="Sürüm" name="version" type="number" defaultValue="1" required/><Field label="Yürürlük tarihi" name="effective_from" type="date" required/><Field label="Çıkış ISO" name="origin_country_code" maxLength={2}/><Field label="Hedef ISO" name="destination_country_code" defaultValue="IR" maxLength={2}/><Field label="Kaynak adı" name="source_label" required/><Field label="Kaynak URL" name="source_url" type="url" required/><label className="col-span-2 block text-sm font-medium text-ink-soft">Zorunlu belgeler (virgülle)<input name="documents" placeholder="Proforma fatura, Menşe belgesi, Taşıma belgesi" className={inputClass}/></label><div className="col-span-2 mt-2 rounded-md border border-line-soft bg-paper p-3"><p className="text-xs font-medium text-ink">İlk maliyet kuralı (isteğe bağlı)</p><div className="mt-2 grid grid-cols-2 gap-2"><Field label="Kural kodu" name="rule_code" defaultValue="customs_rule"/><Field label="Kural etiketi" name="rule_label"/><Select label="Kategori" name="rule_category" options={[["customs","Gümrük"],["tax","Vergi"],["logistics","Lojistik"],["insurance","Sigorta"],["service","Hizmet"],["compliance","Uygunluk"]]}/><Select label="Hesap tipi" name="calculation_type" options={[["percentage","Yüzde"],["fixed","Sabit"]]}/><Select label="Yüzde tabanı" name="base_key" options={[["customs_value","Gümrük kıymeti"],["vehicle_price","Araç fiyatı"],["subtotal","Ara toplam"]]}/><Field label="Oran / tutar" name="rule_value" type="number" step="0.00001" defaultValue="0"/><Field label="Sabit para birimi" name="rule_currency" defaultValue="EUR" maxLength={3}/></div></div><button disabled={pending} className="col-span-2 min-h-11 rounded-md bg-brand px-3 text-sm font-semibold text-white disabled:opacity-50">Onaylı kural setini oluştur</button></form></details>; }

function Field({ label, name, type="text", defaultValue, required, step, maxLength }: { label:string; name:string; type?:string; defaultValue?:string; required?:boolean; step?:string; maxLength?:number }) { return <label className="block text-sm font-medium text-ink-soft">{label}<input name={name} type={type} defaultValue={defaultValue} required={required} step={step} maxLength={maxLength} className={inputClass}/></label>; }
function Select({ label,name,options}:{label:string;name:string;options:string[][]}) { return <label className="block text-sm font-medium text-ink-soft">{label}<select name={name} className={inputClass}>{options.map(([value,text])=><option key={value} value={value}>{text}</option>)}</select></label>; }
const inputClass="mt-1 min-h-11 w-full rounded-md border border-line bg-surface px-3 text-sm text-ink outline-none transition-colors focus:border-brand focus:ring-2 focus:ring-brand/15";
async function api(url:string, init:RequestInit){const response=await fetch(url,{...init,headers:{"content-type":"application/json",...(init.headers??{})}});const body=await response.json().catch(()=>null) as {error?:string}|null;if(!response.ok)throw new Error(body?.error??`HTTP ${response.status}`);}
function readObject(value:Json|undefined|null):Record<string,Json>{return value&&typeof value==="object"&&!Array.isArray(value)?value:{};}
function readArray(value:Json|undefined|null):Array<Record<string,Json>>{return Array.isArray(value)?value.filter((item):item is Record<string,Json>=>Boolean(item&&typeof item==="object"&&!Array.isArray(item))):[];}
function money(value:number,currency:string){return new Intl.NumberFormat("tr-TR",{style:"currency",currency,maximumFractionDigits:2}).format(value);}
function countryGuess(value:string|null|undefined){if(!value)return null;const v=value.toLowerCase();if(v.includes("german")||v.includes("alm")||v.includes("deutsch"))return "DE";if(v.includes("nether")||v.includes("holland"))return "NL";if(/^[a-z]{2}$/i.test(value))return value.toUpperCase();return null;}
function approvalTone(value:ExportScenarioListItem["approval_status"]):PillTone{return value==="approved"?"success":value==="rejected"?"danger":value==="needs_review"?"warning":"neutral";}
function approvalLabel(value:ExportScenarioListItem["approval_status"]){return value==="approved"?"Onaylı":value==="rejected"?"Reddedildi":value==="needs_review"?"İnceleme gerekli":"Onay bekliyor";}
function documentStatus(value:string){return value==="verified"?"Doğrulandı":value==="received"?"Alındı":value==="rejected"?"Reddedildi":value==="not_applicable"?"Uygulanamaz":"Bekliyor";}

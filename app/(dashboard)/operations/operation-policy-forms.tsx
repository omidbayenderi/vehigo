"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Activity, Gauge, HardDriveDownload, WalletCards } from "lucide-react";
import { createBudgetPolicyAction, createRatePolicyAction, createRecoveryDrillAction, createSloPolicyAction, type OperationFormState } from "./actions";

const initialState: OperationFormState = {};
const input = "w-full rounded-xl border border-line bg-surface px-3 text-sm text-ink placeholder:text-ink-faint";
const label = "grid gap-1.5 text-xs font-semibold text-ink-soft";

export function OperationPolicyForms() {
  const [slo, sloAction] = useActionState(createSloPolicyAction, initialState);
  const [budget, budgetAction] = useActionState(createBudgetPolicyAction, initialState);
  const [rate, rateAction] = useActionState(createRatePolicyAction, initialState);
  const [drill, drillAction] = useActionState(createRecoveryDrillAction, initialState);
  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <PolicyForm title="Sağlayıcı SLO" description="Kullanılabilirlik, hata oranı ve gecikme eşiği." icon={Activity} action={sloAction} state={slo}>
        <Field label="Sağlayıcı anahtarı"><input className={input} name="provider_key" required placeholder="mobile.de" /></Field>
        <Field label="Operasyon tipi"><input className={input} name="operation_type" required placeholder="connector.fetch" /></Field>
        <ThreeFields fields={[["Hedef kullanılabilirlik %", "target_availability_percent", "99.5"], ["Maks. hata %", "max_error_rate_percent", "1"], ["Maks. p95 (ms)", "max_p95_latency_ms", "3000"]]} />
        <TwoFields fields={[["Pencere (dk)", "window_minutes", "60"], ["Minimum örnek", "minimum_samples", "20"]]} />
      </PolicyForm>
      <PolicyForm title="Kullanım bütçesi" description="Kaynak tüketimini gözlemleyin veya hard limitte durdurun." icon={WalletCards} action={budgetAction} state={budget}>
        <Field label="Bütçe anahtarı"><input className={input} name="budget_key" required placeholder="scanner.requests" /></Field>
        <div className="grid gap-3 sm:grid-cols-2"><Field label="Dönem"><select className={input} name="period"><option value="daily">Günlük</option><option value="monthly">Aylık</option></select></Field><Field label="Birim"><input className={input} name="unit" required placeholder="request" /></Field></div>
        <TwoFields fields={[["Soft limit", "soft_limit", "800"], ["Hard limit", "hard_limit", "1000"]]} />
        <Field label="Uygulama"><select className={input} name="enforcement"><option value="block">Hard limitte engelle</option><option value="warn">Yalnızca uyar</option></select></Field>
      </PolicyForm>
      <PolicyForm title="Rate limit" description="Kuyruk veya sağlayıcı çağrı hızını sınırlandırın." icon={Gauge} action={rateAction} state={rate}>
        <Field label="Limit anahtarı"><input className={input} name="limit_key" required placeholder="connector.mobile_de" /></Field>
        <TwoFields fields={[["Pencere (sn)", "window_seconds", "60"], ["Maks. istek", "max_requests", "30"]]} />
      </PolicyForm>
      <PolicyForm title="Kurtarma tatbikatı" description="Kanıtlanabilir geri dönüş ve kesinti prosedürü planlayın." icon={HardDriveDownload} action={drillAction} state={drill}>
        <Field label="Tatbikat tipi"><select className={input} name="drill_type"><option value="backup_restore">Backup restore</option><option value="provider_outage">Provider outage</option><option value="queue_recovery">Queue recovery</option><option value="credential_rotation">Credential rotation</option><option value="data_retention">Data retention</option></select></Field>
        <Field label="Kapsam"><textarea className={`${input} min-h-24 py-3`} name="scope" required placeholder="Hangi sistem, veri ve kabul kriteri doğrulanacak?" /></Field>
        <Field label="Planlanan zaman"><input className={input} type="datetime-local" name="planned_for" /></Field>
      </PolicyForm>
    </div>
  );
}

function PolicyForm({ title, description, icon: Icon, action, state, children }: { title: string; description: string; icon: typeof Activity; action: (payload: FormData) => void; state: OperationFormState; children: React.ReactNode }) {
  return <form action={action} className="rounded-2xl border border-line-soft bg-surface p-5 shadow-sm"><div className="mb-5 flex items-start gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-wash text-brand-ink"><Icon className="h-5 w-5" /></span><div><h3 className="font-serif text-lg font-semibold text-ink">{title}</h3><p className="mt-0.5 text-sm leading-5 text-ink-faint">{description}</p></div></div><div className="grid gap-3">{children}</div><div className="mt-5 flex items-center justify-between gap-3"><p className={state.error ? "text-sm text-danger" : "text-sm text-success"} role="status" aria-live="polite">{state.error ?? state.ok}</p><SubmitButton /></div></form>;
}

function Field({ label: text, children }: { label: string; children: React.ReactNode }) { return <label className={label}><span>{text}</span>{children}</label>; }
function TwoFields({ fields }: { fields: [string, string, string][] }) { return <div className="grid gap-3 sm:grid-cols-2">{fields.map(([text, name, placeholder]) => <Field key={name} label={text}><input className={input} type="number" step="any" name={name} required placeholder={placeholder} /></Field>)}</div>; }
function ThreeFields({ fields }: { fields: [string, string, string][] }) { return <div className="grid gap-3 sm:grid-cols-3">{fields.map(([text, name, placeholder]) => <Field key={name} label={text}><input className={input} type="number" step="any" name={name} required placeholder={placeholder} /></Field>)}</div>; }
function SubmitButton() { const { pending } = useFormStatus(); return <button type="submit" disabled={pending} className="min-h-11 shrink-0 cursor-pointer rounded-xl bg-brand px-4 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-wait disabled:opacity-50">{pending ? "Kaydediliyor…" : "Etkinleştir"}</button>; }

"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { CheckCircle2, Play, ShieldAlert } from "lucide-react";
import { completeRecoveryDrillAction, startRecoveryDrillAction, type OperationFormState } from "./actions";

const initialState: OperationFormState = {};
const field = "min-h-11 w-full rounded-xl border border-line bg-surface px-3 text-sm text-ink placeholder:text-ink-faint";

export function RecoveryDrillControls({ drillId, status }: { drillId: string; status: string }) {
  const [startState, startAction] = useActionState(startRecoveryDrillAction.bind(null, drillId), initialState);
  const [completeState, completeAction] = useActionState(completeRecoveryDrillAction.bind(null, drillId), initialState);

  if (status === "planned") return <form action={startAction} className="mt-4 border-t border-line-soft pt-4"><div className="flex flex-wrap items-center justify-between gap-3"><ActionMessage state={startState} /><PendingButton idle="Tatbikatı başlat" pending="Başlatılıyor…" icon={Play} /></div></form>;
  if (status !== "running") return null;

  return <details className="mt-4 rounded-xl border border-line bg-surface">
    <summary className="flex min-h-11 cursor-pointer items-center px-3 text-sm font-semibold text-brand-ink">Kanıt ekle ve tatbikatı kapat</summary>
    <form action={completeAction} className="grid gap-3 border-t border-line-soft p-4">
      <label className="grid gap-1.5 text-xs font-semibold text-ink-soft"><span>Sonuç *</span><select className={field} name="status" required defaultValue="passed"><option value="passed">Başarılı</option><option value="failed">Başarısız — kritik uyarı aç</option></select></label>
      <label className="grid gap-1.5 text-xs font-semibold text-ink-soft"><span>Kanıt notu *</span><textarea className={`${field} min-h-24 py-3`} name="notes" required minLength={3} placeholder="Uygulanan adımlar, doğrulanan kontroller ve gözlenen sonuçlar" /><span className="font-normal leading-5 text-ink-faint">Kararı tekrar üretmeye yetecek somut doğrulama notlarını yazın.</span></label>
      <label className="grid gap-1.5 text-xs font-semibold text-ink-soft"><span>Kanıt bağlantısı</span><input className={field} name="evidence_url" type="url" placeholder="https://…" /></label>
      <div className="grid gap-3 sm:grid-cols-2"><label className="grid gap-1.5 text-xs font-semibold text-ink-soft"><span>RTO (dakika)</span><input className={field} name="rto_minutes" type="number" min="0" step="0.1" /></label><label className="grid gap-1.5 text-xs font-semibold text-ink-soft"><span>RPO (dakika)</span><input className={field} name="rpo_minutes" type="number" min="0" step="0.1" /></label></div>
      <div className="flex flex-wrap items-center justify-between gap-3"><ActionMessage state={completeState} /><PendingButton idle="Kanıtla kapat" pending="Kaydediliyor…" icon={CheckCircle2} /></div>
    </form>
  </details>;
}

function ActionMessage({ state }: { state: OperationFormState }) { return <p className={state.error ? "text-sm text-danger" : "text-sm text-success"} role={state.error ? "alert" : "status"} aria-live="polite">{state.error ? <span className="inline-flex items-center gap-1.5"><ShieldAlert className="h-4 w-4" />{state.error}</span> : state.ok}</p>; }
function PendingButton({ idle, pending: pendingText, icon: Icon }: { idle: string; pending: string; icon: typeof Play }) { const { pending } = useFormStatus(); return <button type="submit" disabled={pending} className="flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl bg-brand px-4 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-wait disabled:opacity-50"><Icon className="h-4 w-4" />{pending ? pendingText : idle}</button>; }

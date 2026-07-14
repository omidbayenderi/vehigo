import { redirect } from "next/navigation";
import { AlertTriangle, CheckCircle2, CircleDot, Clock3, RotateCcw, ServerCog, ShieldAlert, Workflow } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { requireOrganizationOwner } from "@/lib/operations/authorization";
import { createClient } from "@/lib/supabase/server";
import { acknowledgeAlertAction, replayDeadLetterAction } from "./actions";
import { OperationPolicyForms } from "./operation-policy-forms";
import { RecoveryDrillControls } from "./recovery-drill-controls";

export const dynamic = "force-dynamic";

export default async function OperationsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  let organizationId: string;
  try { organizationId = await requireOrganizationOwner(supabase, user.id); } catch { redirect("/dashboard"); }
  const since = operationsWindowStart();
  const [jobs, events, alerts, slos, budgets, rates, drills, succeeded, failedAttempts] = await Promise.all([
    supabase.from("operation_jobs").select("id,queue,job_type,status,priority,attempt_count,max_attempts,replay_count,correlation_id,error_code,error_message,available_at,lease_owner,created_at,completed_at").eq("organization_id", organizationId).order("created_at", { ascending: false }).limit(50),
    supabase.from("operation_events").select("id,job_id,correlation_id,level,event_type,message,occurred_at").eq("organization_id", organizationId).order("occurred_at", { ascending: false }).limit(30),
    supabase.from("operation_alerts").select("id,alert_type,severity,status,title,occurrence_count,last_occurred_at").eq("organization_id", organizationId).order("last_occurred_at", { ascending: false }).limit(30),
    supabase.from("provider_slo_policies").select("id,provider_key,operation_type,target_availability_percent,max_error_rate_percent,max_p95_latency_ms,window_minutes,minimum_samples,enabled").eq("organization_id", organizationId).order("created_at", { ascending: false }),
    supabase.from("usage_budget_policies").select("id,budget_key,period,unit,soft_limit,hard_limit,enforcement,enabled").eq("organization_id", organizationId).order("created_at", { ascending: false }),
    supabase.from("rate_limit_policies").select("id,limit_key,window_seconds,max_requests,enabled").eq("organization_id", organizationId).order("created_at", { ascending: false }),
    supabase.from("recovery_drills").select("id,drill_type,status,scope,planned_for,started_at,completed_at,evidence").eq("organization_id", organizationId).order("created_at", { ascending: false }).limit(20),
    supabase.from("operation_jobs").select("id", { count: "exact", head: true }).eq("organization_id", organizationId).eq("status", "succeeded").gte("completed_at", since),
    supabase.from("operation_attempts").select("id", { count: "exact", head: true }).eq("organization_id", organizationId).in("status", ["failed", "lease_expired"]).gte("started_at", since),
  ]);
  const results = [jobs, events, alerts, slos, budgets, rates, drills, succeeded, failedAttempts];
  const failure = results.find((result) => result.error)?.error;
  if (failure) throw new Error(`Operasyon kontrol düzlemi okunamadı: ${failure.message}`);
  const jobRows = jobs.data ?? [];
  const counts = {
    queued: jobRows.filter((job) => job.status === "queued").length,
    running: jobRows.filter((job) => job.status === "leased" || job.status === "running").length,
    retry: jobRows.filter((job) => job.status === "retry_wait").length,
    dead: jobRows.filter((job) => job.status === "dead_letter").length,
  };
  const openAlerts = (alerts.data ?? []).filter((alert) => alert.status === "open");

  return <div>
    <PageHeader eyebrow="Faz 6 · Operasyon kontrol düzlemi" title="Sistem operasyonları" description="Kuyruk sağlığı, dead-letter replay, SLO ihlalleri, kullanım bütçeleri ve kurtarma tatbikatlarını organizasyon sınırında yönetin." />

    <section aria-labelledby="health-title">
      <div className="mb-3 flex items-center justify-between"><h2 id="health-title" className="text-sm font-semibold uppercase tracking-wide text-ink-soft">Canlı sağlık</h2><span className="inline-flex items-center gap-2 text-xs text-ink-faint"><CircleDot className="h-3.5 w-3.5 text-success" /> Son 24 saat</span></div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        <Metric label="Kuyrukta" value={counts.queued} icon={Workflow} tone="brand" />
        <Metric label="Çalışıyor" value={counts.running} icon={ServerCog} tone="success" />
        <Metric label="Retry bekliyor" value={counts.retry} icon={Clock3} tone="warning" />
        <Metric label="Dead letter" value={counts.dead} icon={ShieldAlert} tone="danger" />
        <Metric label="Başarılı" value={succeeded.count ?? 0} icon={CheckCircle2} tone="success" />
        <Metric label="Hatalı deneme" value={failedAttempts.count ?? 0} icon={AlertTriangle} tone="danger" />
      </div>
    </section>

    <div className="mt-8 grid gap-6 xl:grid-cols-[1.35fr_.65fr]">
      <Section title="Son operasyon işleri" subtitle="En yeni 50 iş; kuyruk, retry ve hata bağlamı birlikte görünür.">
        <div className="grid gap-2">
          {jobRows.length ? jobRows.map((job) => <article key={job.id} className="grid gap-3 rounded-xl border border-line-soft bg-paper/60 p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
            <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><StatusBadge status={job.status} /><span className="font-mono text-xs text-ink-faint">{job.queue}</span><span className="text-sm font-semibold text-ink">{job.job_type}</span></div><p className="mt-2 break-words text-xs leading-5 text-ink-faint">Deneme {job.attempt_count}/{job.max_attempts} · Öncelik {job.priority} · {formatDate(job.created_at)}{job.error_message ? ` · ${job.error_code ?? "error"}: ${job.error_message}` : ""}</p><p className="mt-1 truncate font-mono text-[11px] text-ink-faint" title={job.correlation_id}>corr {job.correlation_id}</p></div>
            {job.status === "dead_letter" ? <form action={replayDeadLetterAction.bind(null, job.id)}><button className="flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border border-line bg-surface px-3 text-sm font-semibold text-ink transition-colors hover:bg-brand-wash hover:text-brand-ink"><RotateCcw className="h-4 w-4" /> Replay</button></form> : null}
          </article>) : <Empty text="Henüz operasyon işi yok." />}
        </div>
      </Section>

      <Section title={`Operasyon uyarıları (${openAlerts.length} açık)`} subtitle="Açık uyarıları sahiplenin; çözülme SLO motoru tarafından izlenir.">
        <div className="grid gap-2">
          {(alerts.data ?? []).length ? (alerts.data ?? []).map((alert) => <article key={alert.id} className="rounded-xl border border-line-soft bg-paper/60 p-4"><div className="flex items-start justify-between gap-3"><div><div className="flex flex-wrap items-center gap-2"><SeverityBadge severity={alert.severity} /><span className="text-xs font-medium uppercase text-ink-faint">{alert.status}</span></div><h3 className="mt-2 text-sm font-semibold leading-5 text-ink">{alert.title}</h3><p className="mt-1 text-xs text-ink-faint">{alert.occurrence_count} tekrar · {formatDate(alert.last_occurred_at)}</p></div>{alert.status === "open" ? <form action={acknowledgeAlertAction.bind(null, alert.id)}><button className="min-h-11 cursor-pointer rounded-xl border border-line bg-surface px-3 text-xs font-semibold text-ink hover:bg-surface-sunken">Üstlen</button></form> : null}</div></article>) : <Empty text="Aktif operasyon uyarısı yok." />}
        </div>
      </Section>
    </div>

    <div className="mt-8"><Section title="Koruma politikaları" subtitle="Gerçek sağlayıcı ve bütçe değerlerini siz doğrulamadan sistem varsayımsal limit üretmez."><PolicySummary slos={slos.data ?? []} budgets={budgets.data ?? []} rates={rates.data ?? []} /><details className="mt-5 rounded-xl border border-line-soft bg-paper/60"><summary className="flex min-h-12 cursor-pointer items-center px-4 text-sm font-semibold text-brand-ink">Yeni politika veya tatbikat oluştur</summary><div className="border-t border-line-soft p-4"><OperationPolicyForms /></div></details></Section></div>

    <div className="mt-8 grid gap-6 xl:grid-cols-2">
      <Section title="Kurtarma tatbikatları" subtitle="Plan, durum ve kanıt yaşam döngüsü."><div className="grid gap-2">{(drills.data ?? []).length ? (drills.data ?? []).map((drill) => <article key={drill.id} className="rounded-xl border border-line-soft bg-paper/60 p-4"><div className="flex flex-wrap items-center gap-2"><StatusBadge status={drill.status} /><span className="text-xs font-semibold uppercase text-ink-faint">{drill.drill_type.replaceAll("_", " ")}</span></div><p className="mt-2 text-sm leading-6 text-ink">{drill.scope}</p><p className="mt-1 text-xs text-ink-faint">{drill.completed_at ? `Tamamlandı: ${formatDate(drill.completed_at)}` : drill.started_at ? `Başladı: ${formatDate(drill.started_at)}` : drill.planned_for ? `Plan: ${formatDate(drill.planned_for)}` : "Tarih henüz atanmadı"}</p><RecoveryDrillControls drillId={drill.id} status={drill.status} /></article>) : <Empty text="Planlanmış kurtarma tatbikatı yok." />}</div></Section>
      <Section title="Olay akışı" subtitle="Correlation ID ile işten sağlayıcı gözlemine kadar izlenebilir."><div className="grid gap-2">{(events.data ?? []).length ? (events.data ?? []).map((event) => <article key={event.id} className="border-l-2 border-line pl-4"><div className="flex flex-wrap items-center gap-2"><SeverityBadge severity={event.level === "error" ? "critical" : event.level === "warn" ? "warning" : "info"} /><span className="text-xs font-semibold text-ink-soft">{event.event_type}</span><time className="text-xs text-ink-faint">{formatDate(event.occurred_at)}</time></div><p className="mt-1 text-sm leading-5 text-ink">{event.message}</p><p className="mt-1 truncate font-mono text-[11px] text-ink-faint" title={event.correlation_id}>{event.correlation_id}</p></article>) : <Empty text="Henüz operasyon olayı yok." />}</div></Section>
    </div>
  </div>;
}

function Section({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) { return <section className="rounded-2xl border border-line-soft bg-surface p-5 shadow-sm sm:p-6"><h2 className="font-serif text-xl font-semibold text-ink">{title}</h2><p className="mt-1 mb-5 text-sm leading-5 text-ink-faint">{subtitle}</p>{children}</section>; }
function Metric({ label, value, icon: Icon, tone }: { label: string; value: number; icon: typeof Workflow; tone: "brand" | "success" | "warning" | "danger" }) { const tones = { brand: "bg-brand-wash text-brand-ink", success: "bg-success-wash text-success", warning: "bg-warning-wash text-warning", danger: "bg-danger-wash text-danger" }; return <article className="rounded-2xl border border-line-soft bg-surface p-4 shadow-sm"><div className={`flex h-9 w-9 items-center justify-center rounded-xl ${tones[tone]}`}><Icon className="h-4 w-4" /></div><p className="mt-4 text-2xl font-semibold tabular-nums text-ink">{value.toLocaleString("tr-TR")}</p><p className="mt-0.5 text-xs font-medium text-ink-faint">{label}</p></article>; }
function StatusBadge({ status }: { status: string }) { const style = status === "succeeded" || status === "passed" ? "bg-success-wash text-success" : status === "dead_letter" || status === "failed" ? "bg-danger-wash text-danger" : status === "retry_wait" ? "bg-warning-wash text-warning" : "bg-brand-wash text-brand-ink"; return <span className={`rounded-full px-2 py-1 text-[11px] font-semibold ${style}`}>{status.replaceAll("_", " ")}</span>; }
function SeverityBadge({ severity }: { severity: "info" | "warning" | "critical" }) { const style = severity === "critical" ? "bg-danger-wash text-danger" : severity === "warning" ? "bg-warning-wash text-warning" : "bg-brand-wash text-brand-ink"; return <span className={`rounded-full px-2 py-1 text-[11px] font-semibold ${style}`}>{severity}</span>; }
function Empty({ text }: { text: string }) { return <p className="rounded-xl border border-dashed border-line p-6 text-center text-sm text-ink-faint">{text}</p>; }
function formatDate(value: string) { return new Intl.DateTimeFormat("tr-TR", { dateStyle: "short", timeStyle: "short", timeZone: "Europe/Berlin" }).format(new Date(value)); }
function operationsWindowStart() { return new Date(Date.now() - 86_400_000).toISOString(); }
function PolicySummary({ slos, budgets, rates }: { slos: { id: string; provider_key: string; operation_type: string; target_availability_percent: number; max_error_rate_percent: number; max_p95_latency_ms: number; window_minutes: number; minimum_samples: number; enabled: boolean }[]; budgets: { id: string; budget_key: string; period: string; unit: string; soft_limit: number; hard_limit: number; enforcement: string; enabled: boolean }[]; rates: { id: string; limit_key: string; window_seconds: number; max_requests: number; enabled: boolean }[] }) { const rows = [...slos.map((p) => ({ id: p.id, type: "SLO", key: `${p.provider_key} · ${p.operation_type}`, value: `${p.target_availability_percent}% / ${p.max_error_rate_percent}% / ${p.max_p95_latency_ms}ms`, enabled: p.enabled })), ...budgets.map((p) => ({ id: p.id, type: "Bütçe", key: p.budget_key, value: `${p.soft_limit} → ${p.hard_limit} ${p.unit} · ${p.period} · ${p.enforcement}`, enabled: p.enabled })), ...rates.map((p) => ({ id: p.id, type: "Rate", key: p.limit_key, value: `${p.max_requests} istek / ${p.window_seconds}sn`, enabled: p.enabled }))]; return <div className="grid gap-2">{rows.length ? rows.map((row) => <div key={`${row.type}-${row.id}`} className="grid gap-1 rounded-xl border border-line-soft bg-paper/60 p-4 sm:grid-cols-[5rem_minmax(0,1fr)_auto] sm:items-center"><span className="text-xs font-semibold uppercase text-brand-ink">{row.type}</span><div className="min-w-0"><p className="truncate text-sm font-semibold text-ink">{row.key}</p><p className="mt-0.5 text-xs text-ink-faint">{row.value}</p></div><span className={`text-xs font-semibold ${row.enabled ? "text-success" : "text-ink-faint"}`}>{row.enabled ? "Etkin" : "Kapalı"}</span></div>) : <Empty text="Henüz koruma politikası tanımlanmadı." />}</div>; }

import Link from "next/link";
import { Activity, AlertTriangle, ArrowUpRight, BellRing, CheckCircle2, Coins, FileText, ListChecks, Radio, Send, Sparkles, Truck, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getDashboardMetrics } from "@/lib/services/dashboard";
import { PageHeader } from "@/components/ui/page-header";
import { cardClass } from "@/lib/ui";
import { DashboardRefreshButton } from "@/components/ui/dashboard-refresh-button";

const statusLabel: Record<string, string> = {
  new: "Yeni",
  contacted: "İletişime Geçildi",
  interested: "İlgileniyor",
  vehicle_proposed: "Araç Önerildi",
  offer_sent: "Teklif Gönderildi",
  deposit_requested: "Kapora İstendi",
  in_progress: "İşlemde",
  closed_won: "Kazanıldı",
  closed_lost: "Kaybedildi",
};

const statusBarColor: Record<string, string> = {
  new: "#8B8B9E",
  contacted: "#2D3FE0",
  interested: "#2D3FE0",
  vehicle_proposed: "#B45309",
  offer_sent: "#B45309",
  deposit_requested: "#B45309",
  in_progress: "#2D3FE0",
  closed_won: "#15803D",
  closed_lost: "#B91C1C",
};

export default async function DashboardPage() {
  const supabase = await createClient();
  const metrics = await getDashboardMetrics(supabase);
  const maxStatusCount = Math.max(1, ...Object.keys(statusLabel).map((s) => metrics.leadsByStatus[s] ?? 0));

  return (
    <div>
      <PageHeader
        eyebrow="Canlı operasyon merkezi"
        title="Avrupa araç pazarınız, tek bakışta."
        description="Fırsatları keşfedin, ticari potansiyeli ölçün ve müşteriye dönüşen akışı tek bir operasyon merkezinden yönetin."
        actions={(
          <div className="flex items-center gap-3">
            <div className="text-right text-xs text-ink-faint">
              <span className="flex items-center justify-end gap-1.5 font-medium text-success">
                <span className="live-dot h-2 w-2 rounded-full bg-success" aria-hidden="true" />
                Sistemler çevrimiçi
              </span>
              <time dateTime={metrics.measuredAt}>Son kontrol {formatTime(metrics.measuredAt)}</time>
            </div>
            <DashboardRefreshButton />
          </div>
        )}
      />

      <section className="relative mb-6 overflow-hidden rounded-[1.5rem] bg-[#10192b] p-5 text-white shadow-[0_24px_70px_rgba(16,25,43,0.18)] sm:p-7">
        <div className="absolute -right-16 -top-28 h-80 w-80 rounded-full bg-brand/35 blur-3xl" aria-hidden="true" />
        <div className="absolute bottom-0 right-0 h-36 w-2/5 bg-[linear-gradient(135deg,transparent,rgba(99,130,255,0.13))]" aria-hidden="true" />
        <div className="relative grid gap-6 lg:grid-cols-[1.35fr_1fr] lg:items-end">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.06] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-indigo-200"><Sparkles className="h-3.5 w-3.5" /> Fırsat radarı</span>
            <p className="mt-5 max-w-xl font-serif text-2xl font-semibold tracking-[-0.025em] sm:text-3xl">{metrics.newOpportunityCount > 0 ? `${metrics.newOpportunityCount} yeni ticari fırsat kararınızı bekliyor.` : "Pazar taraması aktif; yeni fırsatlar izleniyor."}</p>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">Vehigo, Avrupa genelindeki ilan akışını filtrelerinizle karşılaştırıyor ve yüksek potansiyelli araçları önceliklendiriyor.</p>
          </div>
          <div className="flex flex-wrap gap-3 lg:justify-end">
            <Link href="/shortlist" className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-white px-4 text-sm font-semibold text-[#10192b] transition-transform hover:-translate-y-0.5">Fırsatları incele <ArrowUpRight className="h-4 w-4" /></Link>
            <Link href="/alerts" className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/15 bg-white/[0.06] px-4 text-sm font-semibold text-white hover:bg-white/10">Yeni alarm kur</Link>
          </div>
        </div>
      </section>

      <div className="mb-6 grid gap-4 lg:grid-cols-2">
        <ActionCard
          icon={BellRing}
          title={`${metrics.newOpportunityCount} yeni fırsat bekliyor`}
          description="Henüz karar vermediğiniz ilanları fiyat ve uygunluk skoruna göre inceleyin."
          href="/shortlist"
          action="Fırsatları değerlendir"
          tone={metrics.newOpportunityCount > 0 ? "brand" : "success"}
        />
        <ActionCard
          icon={ListChecks}
          title={`${metrics.shortlistedOpportunityCount} araç kısa listede`}
          description="Satıcı kontrolü, toplam maliyet ve müşteri eşleştirmesi için sıradaki araçlar."
          href="/alerts"
          action="Kısa listeyi aç"
          tone="warning"
        />
      </div>

      <div className="mb-6 grid gap-3 md:grid-cols-2">
          <HealthNotice
            ok={metrics.telegramReady && metrics.telegramFailureCount === 0}
            title={!metrics.telegramReady ? "Telegram bağlantısı tamamlanmadı" : metrics.telegramFailureCount > 0 ? `${metrics.telegramFailureCount} Telegram teslimatı başarısız` : "Telegram hazır"}
            description={!metrics.telegramReady ? "Yeni ilan özetlerini alabilmek için bot bağlantısını doğrulayın." : metrics.telegramFailureCount > 0 ? "Başarısız mesajları alarm merkezinden inceleyin." : "Bot doğrulandı ve bekleyen teslimat hatası yok."}
          />
          <HealthNotice
            ok={metrics.scannerHealthIssueCount === 0}
            title={metrics.scannerHealthIssueCount === 0 ? "İlan motoru sağlıklı" : `${metrics.scannerHealthIssueCount} kaynakta sorun var`}
            description={metrics.scannerHealthIssueCount === 0 ? `${metrics.activeSourceCount} aktif kaynak beklenen aralıkta çalışıyor.` : `${metrics.healthySourceCount}/${metrics.activeSourceCount} kaynak sağlıklı. Eksik ilan riskini kontrol edin.`}
          />
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 xl:grid-cols-4">
        <MetricCard icon={Users} tone="brand" label="Aktif müşteri" value={metrics.activeLeadCount.toString()} />
        <MetricCard icon={FileText} tone="warning" label="Açık teklif" value={metrics.openOfferCount.toString()} />
        <MetricCard
          icon={Coins}
          tone="success"
          label="Beklenen komisyon"
          value={formatMoneyTotals(metrics.expectedCommissionTotals)}
        />
        <MetricCard
          icon={Truck}
          tone="brand"
          label="Uygun araç"
          value={`${metrics.availableVehicleCount} / ${metrics.totalVehicleCount}`}
        />
      </div>

      <section className={`${cardClass} mb-6 overflow-hidden`} aria-labelledby="market-pulse-title">
        <div className="flex flex-col gap-2 border-b border-line-soft px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 id="market-pulse-title" className="font-medium text-ink">Pazar motoru · son 24 saat</h2>
            <p className="mt-0.5 text-xs text-ink-faint">Scanner çalışma kayıtlarından hesaplanan canlı hacim</p>
          </div>
          <p className="text-xs text-ink-faint">Son başarılı tarama: <strong className="font-medium text-ink-soft">{formatRelativeTime(metrics.lastSuccessfulScanAt)}</strong></p>
        </div>
        <div className="grid grid-cols-2 divide-x divide-y divide-line-soft md:grid-cols-4 md:divide-y-0">
          <PulseMetric icon={Radio} label="Yeni ilan" value={metrics.listingsDiscovered24h} />
          <PulseMetric icon={BellRing} label="Kriter eşleşmesi" value={metrics.alertsCreated24h} />
          <PulseMetric icon={Activity} label="Sağlıklı kaynak" value={`${metrics.healthySourceCount}/${metrics.activeSourceCount}`} />
          <PulseMetric icon={Send} label="Teslimat hatası" value={metrics.telegramFailureCount} danger={metrics.telegramFailureCount > 0} />
        </div>
      </section>

      <div className={`${cardClass} p-6`}>
        <h2 className="mb-4 text-sm font-medium text-ink-soft">Müşteri durumlarına göre dağılım</h2>
        <div className="space-y-3">
          {Object.entries(statusLabel).map(([status, label]) => {
            const count = metrics.leadsByStatus[status] ?? 0;
            return (
              <div key={status} className="flex items-center gap-3 text-sm">
                <span className="w-36 shrink-0 text-ink-soft">{label}</span>
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-sunken">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${(count / maxStatusCount) * 100}%`, backgroundColor: statusBarColor[status] }}
                  />
                </div>
                <span className="w-6 shrink-0 text-right font-medium text-ink" style={{ fontVariantNumeric: "tabular-nums" }}>
                  {count}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat("tr-TR", { hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(new Date(value));
}

function formatRelativeTime(value: string | null) {
  if (!value) return "Henüz başarılı çalışma yok";
  const minutes = Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 60_000));
  if (minutes < 1) return "şimdi";
  if (minutes < 60) return `${minutes} dk önce`;
  const hours = Math.round(minutes / 60);
  return hours < 24 ? `${hours} sa önce` : `${Math.round(hours / 24)} gün önce`;
}

function formatMoneyTotals(totals: Array<{ currency: string; amount: number }>) {
  if (totals.length === 0) return "0 EUR";
  return totals.map(({ amount, currency }) => `${amount.toLocaleString("tr-TR", { maximumFractionDigits: 0 })} ${currency}`).join(" · ");
}

function PulseMetric({ icon: Icon, label, value, danger = false }: { icon: React.ComponentType<{ className?: string; strokeWidth?: number }>; label: string; value: string | number; danger?: boolean }) {
  return (
    <div className="flex min-h-24 items-center gap-3 p-4">
      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${danger ? "bg-danger-wash text-danger" : "bg-surface-sunken text-brand"}`}>
        <Icon className="h-4 w-4" strokeWidth={1.8} aria-hidden="true" />
      </span>
      <div>
        <p className="text-xs text-ink-faint">{label}</p>
        <p className={`mt-0.5 text-xl font-semibold tabular-nums ${danger ? "text-danger" : "text-ink"}`}>{value}</p>
      </div>
    </div>
  );
}

function ActionCard({
  icon: Icon,
  title,
  description,
  href,
  action,
  tone,
}: {
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  title: string;
  description: string;
  href: string;
  action: string;
  tone: "brand" | "success" | "warning";
}) {
  const toneClasses = {
    brand: "border-brand/30 bg-brand-wash text-brand-ink",
    success: "border-success/30 bg-success-wash text-success",
    warning: "border-warning/30 bg-warning-wash text-warning",
  }[tone];

  return (
    <section className={`${cardClass} p-5`}>
      <div className="flex items-start gap-3">
        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full border ${toneClasses}`}>
          <Icon className="h-5 w-5" strokeWidth={1.8} />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="font-medium text-ink">{title}</h2>
          <p className="mt-1 text-sm text-ink-faint">{description}</p>
          <Link href={href} className="mt-3 inline-flex text-sm font-medium text-brand hover:text-brand-ink">
            {action} →
          </Link>
        </div>
      </div>
    </section>
  );
}

function HealthNotice({ ok, title, description }: { ok: boolean; title: string; description: string }) {
  const Icon = ok ? CheckCircle2 : AlertTriangle;
  return (
    <Link
      href="/alerts"
      className={ok
        ? "premium-card flex items-start gap-3 rounded-xl border-success/20 p-4 transition-transform hover:-translate-y-0.5"
        : "premium-card flex items-start gap-3 rounded-xl border-warning/30 p-4 transition-transform hover:-translate-y-0.5"}
    >
      <Icon className={ok ? "mt-0.5 h-5 w-5 text-success" : "mt-0.5 h-5 w-5 text-warning"} strokeWidth={1.8} />
      <span>
        <span className="block text-sm font-medium text-ink">{title}</span>
        <span className="mt-0.5 block text-xs text-ink-soft">{description}</span>
      </span>
    </Link>
  );
}

function MetricCard({
  icon: Icon,
  tone,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  tone: "brand" | "success" | "warning";
  label: string;
  value: string;
}) {
  const toneClasses = {
    brand: "bg-brand-wash text-brand-ink",
    success: "bg-success-wash text-success",
    warning: "bg-warning-wash text-warning",
  }[tone];
  const accentColor = {
    brand: "#2D3FE0",
    success: "#15803D",
    warning: "#B45309",
  }[tone];

  return (
    <div
      className={`${cardClass} border-l-[3px] p-5 transition-all hover:-translate-y-0.5 hover:shadow-lg`}
      style={{ borderLeftColor: accentColor }}
    >
      <div className="flex items-center justify-between">
        <p className="text-xs text-ink-faint">{label}</p>
        <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${toneClasses}`}>
          <Icon className="h-3.5 w-3.5" strokeWidth={2} />
        </span>
      </div>
      <p className="mt-2 font-serif text-2xl font-semibold text-ink" style={{ fontVariantNumeric: "tabular-nums" }}>
        {value}
      </p>
    </div>
  );
}

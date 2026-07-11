import Link from "next/link";
import { AlertTriangle, BellRing, CheckCircle2, Coins, FileText, ListChecks, Truck, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getDashboardMetrics } from "@/lib/services/dashboard";
import { PageHeader } from "@/components/ui/page-header";
import { cardClass } from "@/lib/ui";

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
        eyebrow="Günlük çalışma masası"
        title="Bugün ne yapmalısınız?"
        description="Yeni fırsatları değerlendirin, kısa listenizi ilerletin ve ilan motorunun hazır olduğundan emin olun."
      />

      <div className="mb-6 grid gap-4 lg:grid-cols-2">
        <ActionCard
          icon={BellRing}
          title={`${metrics.newOpportunityCount} yeni fırsat bekliyor`}
          description="Henüz karar vermediğiniz ilanları fiyat ve uygunluk skoruna göre inceleyin."
          href="/alerts"
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

      {(!metrics.telegramReady || metrics.scannerHealthIssueCount > 0) ? (
        <div className="mb-6 grid gap-3 md:grid-cols-2">
          <HealthNotice
            ok={metrics.telegramReady}
            title={metrics.telegramReady ? "Telegram hazır" : "Telegram bağlantısı tamamlanmadı"}
            description={metrics.telegramReady ? "Sabah ve akşam özetleri bu hesaba gönderilecek." : "Yeni ilan özetlerini alabilmek için bot bağlantısını doğrulayın."}
          />
          <HealthNotice
            ok={metrics.scannerHealthIssueCount === 0}
            title={metrics.scannerHealthIssueCount === 0 ? "İlan motoru sağlıklı" : `${metrics.scannerHealthIssueCount} kaynakta sorun var`}
            description={metrics.scannerHealthIssueCount === 0 ? "Aktif kaynaklar beklenen aralıkta çalışıyor." : "Eksik ilan kaçırmamak için kaynak durumunu kontrol edin."}
          />
        </div>
      ) : null}

      <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
        <MetricCard icon={Users} tone="brand" label="Aktif müşteri" value={metrics.activeLeadCount.toString()} />
        <MetricCard icon={FileText} tone="warning" label="Açık teklif" value={metrics.openOfferCount.toString()} />
        <MetricCard
          icon={Coins}
          tone="success"
          label="Beklenen komisyon"
          value={metrics.expectedCommissionTotal.toLocaleString("tr-TR")}
        />
        <MetricCard
          icon={Truck}
          tone="brand"
          label="Uygun araç"
          value={`${metrics.availableVehicleCount} / ${metrics.totalVehicleCount}`}
        />
      </div>

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
        ? "flex items-start gap-3 rounded-lg border border-success/20 bg-success-wash p-4"
        : "flex items-start gap-3 rounded-lg border border-warning/30 bg-warning-wash p-4"}
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
      className={`${cardClass} border-l-[3px] p-4 transition-shadow hover:shadow-md`}
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

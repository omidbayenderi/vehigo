import { createClient } from "@/lib/supabase/server";
import { getDashboardMetrics } from "@/lib/services/dashboard";

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

export default async function DashboardPage() {
  const supabase = await createClient();
  const metrics = await getDashboardMetrics(supabase);

  return (
    <div>
      <h1 className="mb-6 text-2xl font-serif font-semibold text-ink">Panel</h1>

      <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
        <MetricCard label="Aktif müşteri" value={metrics.activeLeadCount.toString()} />
        <MetricCard label="Açık teklif" value={metrics.openOfferCount.toString()} />
        <MetricCard
          label="Beklenen komisyon"
          value={metrics.expectedCommissionTotal.toLocaleString("tr-TR")}
        />
        <MetricCard
          label="Uygun araç"
          value={`${metrics.availableVehicleCount} / ${metrics.totalVehicleCount}`}
        />
      </div>

      <div className="rounded-lg border border-line-soft bg-white p-6">
        <h2 className="mb-4 text-sm font-medium text-ink-soft">Müşteri durumlarına göre dağılım</h2>
        <div className="space-y-2">
          {Object.entries(statusLabel).map(([status, label]) => (
            <div key={status} className="flex items-center justify-between text-sm">
              <span className="text-ink-soft">{label}</span>
              <span className="font-medium text-ink">{metrics.leadsByStatus[status] ?? 0}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-line-soft bg-white p-4">
      <p className="text-xs text-ink-faint">{label}</p>
      <p className="mt-1 text-2xl font-serif font-semibold text-ink">{value}</p>
    </div>
  );
}

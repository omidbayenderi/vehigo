import Link from "next/link";
import { Search, Truck } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { listVehicles } from "@/lib/services/vehicles";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { cardClass, pillClasses, type PillTone } from "@/lib/ui";
import ImportCsvForm from "./import-csv-form";

const statusLabel: Record<string, string> = {
  available: "Uygun",
  reserved: "Rezerve",
  sold: "Satıldı",
  expired: "Süresi Doldu",
};

const statusTone: Record<string, PillTone> = {
  available: "success",
  reserved: "warning",
  sold: "neutral",
  expired: "danger",
};

export default async function VehiclesPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; vehicle_type?: string; availability_status?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();
  const vehicles = await listVehicles(supabase, params);

  return (
    <div>
      <PageHeader
        eyebrow="Envanter"
        title="Araçlar"
        description="Satışa hazır ağır vasıta stoğu."
        actions={
          <>
            <ImportCsvForm />
            <Link
              href="/vehicles/new"
              prefetch={false}
              className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-ink"
            >
              Yeni araç
            </Link>
          </>
        }
      />

      <form className="mb-4 flex gap-2" method="get">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" strokeWidth={1.75} />
          <input
            type="text"
            name="search"
            placeholder="Marka veya model ara..."
            defaultValue={params.search ?? ""}
            className="rounded-md border border-line bg-surface py-2 pl-9 pr-3 text-sm text-ink focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15"
          />
        </div>
        <button
          type="submit"
          className="rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink-soft transition-colors hover:bg-surface-sunken hover:text-ink"
        >
          Filtrele
        </button>
      </form>

      <div className={`overflow-hidden ${cardClass}`}>
        <table className="w-full text-sm">
          <thead className="bg-paper text-left text-xs uppercase tracking-wide text-ink-faint">
            <tr>
              <th className="px-4 py-3">Marka / Model</th>
              <th className="px-4 py-3">Yıl</th>
              <th className="px-4 py-3">Km</th>
              <th className="px-4 py-3">Fiyat</th>
              <th className="px-4 py-3">Tip</th>
              <th className="px-4 py-3">Durum</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line-soft">
            {vehicles?.map((v) => (
              <tr key={v.id} className="transition-colors hover:bg-surface-sunken">
                <td className="px-4 py-3">
                  <Link href={`/vehicles/${v.id}`} prefetch={false} className="font-medium text-ink hover:underline">
                    {v.brand} {v.model}
                  </Link>
                </td>
                <td className="px-4 py-3 text-ink-soft" style={{ fontVariantNumeric: "tabular-nums" }}>{v.year ?? "-"}</td>
                <td className="px-4 py-3 text-ink-soft" style={{ fontVariantNumeric: "tabular-nums" }}>
                  {v.mileage_km?.toLocaleString("tr-TR") ?? "-"}
                </td>
                <td className="px-4 py-3 text-ink-soft" style={{ fontVariantNumeric: "tabular-nums" }}>
                  {v.price?.toLocaleString("tr-TR")} {v.currency}
                </td>
                <td className="px-4 py-3 text-ink-soft">{v.vehicle_type ?? "-"}</td>
                <td className="px-4 py-3">
                  <span className={pillClasses(statusTone[v.availability_status])}>
                    {statusLabel[v.availability_status] ?? v.availability_status}
                  </span>
                </td>
              </tr>
            ))}
            {vehicles?.length === 0 ? (
              <tr>
                <td colSpan={6}>
                  <EmptyState icon={Truck} title="Henüz araç eklenmedi" description="Yeni araç ekleyerek envanteri oluşturmaya başlayın." />
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}

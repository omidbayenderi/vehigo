import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { listVehicles } from "@/lib/services/vehicles";
import ImportCsvForm from "./import-csv-form";

const statusLabel: Record<string, string> = {
  available: "Uygun",
  reserved: "Rezerve",
  sold: "Satıldı",
  expired: "Süresi Doldu",
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
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-serif font-semibold text-ink">Araçlar</h1>
        <div className="flex gap-2">
          <ImportCsvForm />
          <Link
            href="/vehicles/new"
            prefetch={false}
            className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-ink"
          >
            Yeni araç
          </Link>
        </div>
      </div>

      <form className="mb-4 flex gap-2" method="get">
        <input
          type="text"
          name="search"
          placeholder="Marka veya model ara..."
          defaultValue={params.search ?? ""}
          className="rounded-md border border-line px-3 py-2 text-sm"
        />
        <button
          type="submit"
          className="rounded-md border border-line px-3 py-2 text-sm hover:bg-surface-sunken"
        >
          Filtrele
        </button>
      </form>

      <div className="overflow-hidden rounded-lg border border-line-soft bg-white">
        <table className="w-full text-sm">
          <thead className="bg-paper text-left text-xs uppercase text-ink-faint">
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
              <tr key={v.id} className="hover:bg-paper">
                <td className="px-4 py-3">
                  <Link href={`/vehicles/${v.id}`} prefetch={false} className="font-medium text-ink hover:underline">
                    {v.brand} {v.model}
                  </Link>
                </td>
                <td className="px-4 py-3 text-ink-soft">{v.year ?? "-"}</td>
                <td className="px-4 py-3 text-ink-soft">{v.mileage_km?.toLocaleString("tr-TR") ?? "-"}</td>
                <td className="px-4 py-3 text-ink-soft">
                  {v.price?.toLocaleString("tr-TR")} {v.currency}
                </td>
                <td className="px-4 py-3 text-ink-soft">{v.vehicle_type ?? "-"}</td>
                <td className="px-4 py-3">
                  <span className="rounded-full bg-surface-sunken px-2 py-1 text-xs text-ink-soft">
                    {statusLabel[v.availability_status] ?? v.availability_status}
                  </span>
                </td>
              </tr>
            ))}
            {vehicles?.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-ink-faint">
                  Henüz araç eklenmedi.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}

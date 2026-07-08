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
        <h1 className="text-2xl font-semibold text-zinc-900">Araçlar</h1>
        <div className="flex gap-2">
          <ImportCsvForm />
          <Link
            href="/vehicles/new"
            className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700"
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
          className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
        />
        <button
          type="submit"
          className="rounded-md border border-zinc-300 px-3 py-2 text-sm hover:bg-zinc-100"
        >
          Filtrele
        </button>
      </form>

      <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 text-left text-xs uppercase text-zinc-500">
            <tr>
              <th className="px-4 py-3">Marka / Model</th>
              <th className="px-4 py-3">Yıl</th>
              <th className="px-4 py-3">Km</th>
              <th className="px-4 py-3">Fiyat</th>
              <th className="px-4 py-3">Tip</th>
              <th className="px-4 py-3">Durum</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {vehicles?.map((v) => (
              <tr key={v.id} className="hover:bg-zinc-50">
                <td className="px-4 py-3">
                  <Link href={`/vehicles/${v.id}`} className="font-medium text-zinc-900 hover:underline">
                    {v.brand} {v.model}
                  </Link>
                </td>
                <td className="px-4 py-3 text-zinc-600">{v.year ?? "-"}</td>
                <td className="px-4 py-3 text-zinc-600">{v.mileage_km?.toLocaleString("tr-TR") ?? "-"}</td>
                <td className="px-4 py-3 text-zinc-600">
                  {v.price?.toLocaleString("tr-TR")} {v.currency}
                </td>
                <td className="px-4 py-3 text-zinc-600">{v.vehicle_type ?? "-"}</td>
                <td className="px-4 py-3">
                  <span className="rounded-full bg-zinc-100 px-2 py-1 text-xs text-zinc-700">
                    {statusLabel[v.availability_status] ?? v.availability_status}
                  </span>
                </td>
              </tr>
            ))}
            {vehicles?.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-zinc-500">
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

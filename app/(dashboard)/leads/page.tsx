import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { listLeads } from "@/lib/services/leads";

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

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; status?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();
  const leads = await listLeads(supabase, params);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-zinc-900">Müşteriler</h1>
        <Link
          href="/leads/new"
          prefetch={false}
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700"
        >
          Yeni müşteri
        </Link>
      </div>

      <form className="mb-4 flex gap-2" method="get">
        <input
          type="text"
          name="search"
          placeholder="İsim ara..."
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
              <th className="px-4 py-3">İsim / Şirket</th>
              <th className="px-4 py-3">Şehir</th>
              <th className="px-4 py-3">Bütçe</th>
              <th className="px-4 py-3">Ciddiyet</th>
              <th className="px-4 py-3">Durum</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {leads?.map((lead) => (
              <tr key={lead.id} className="hover:bg-zinc-50">
                <td className="px-4 py-3">
                  <Link href={`/leads/${lead.id}`} prefetch={false} className="font-medium text-zinc-900 hover:underline">
                    {lead.company_or_name}
                  </Link>
                </td>
                <td className="px-4 py-3 text-zinc-600">{lead.city ?? "-"}</td>
                <td className="px-4 py-3 text-zinc-600">
                  {lead.budget_min ?? "?"}-{lead.budget_max ?? "?"} {lead.budget_currency}
                </td>
                <td className="px-4 py-3 text-zinc-600">{lead.seriousness_score}</td>
                <td className="px-4 py-3">
                  <span className="rounded-full bg-zinc-100 px-2 py-1 text-xs text-zinc-700">
                    {statusLabel[lead.status] ?? lead.status}
                  </span>
                </td>
              </tr>
            ))}
            {leads?.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-zinc-500">
                  Henüz müşteri eklenmedi.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}

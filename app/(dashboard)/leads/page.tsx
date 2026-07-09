import Link from "next/link";
import { Search, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { listLeads } from "@/lib/services/leads";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { cardClass, pillClasses, type PillTone } from "@/lib/ui";

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

const statusTone: Record<string, PillTone> = {
  new: "neutral",
  contacted: "brand",
  interested: "brand",
  vehicle_proposed: "warning",
  offer_sent: "warning",
  deposit_requested: "warning",
  in_progress: "brand",
  closed_won: "success",
  closed_lost: "danger",
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
      <PageHeader
        eyebrow="CRM"
        title="Müşteriler"
        description="Aktif ve geçmiş müşteri talepleri."
        actions={
          <Link
            href="/leads/new"
            prefetch={false}
            className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-ink"
          >
            Yeni müşteri
          </Link>
        }
      />

      <form className="mb-4 flex gap-2" method="get">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" strokeWidth={1.75} />
          <input
            type="text"
            name="search"
            placeholder="İsim ara..."
            defaultValue={params.search ?? ""}
            className="rounded-md border border-line py-2 pl-9 pr-3 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15"
          />
        </div>
        <button
          type="submit"
          className="rounded-md border border-line px-3 py-2 text-sm transition-colors hover:bg-surface-sunken"
        >
          Filtrele
        </button>
      </form>

      <div className={`overflow-hidden ${cardClass}`}>
        <table className="w-full text-sm">
          <thead className="bg-paper text-left text-xs uppercase tracking-wide text-ink-faint">
            <tr>
              <th className="px-4 py-3">İsim / Şirket</th>
              <th className="px-4 py-3">Şehir</th>
              <th className="px-4 py-3">Bütçe</th>
              <th className="px-4 py-3">Ciddiyet</th>
              <th className="px-4 py-3">Durum</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line-soft">
            {leads?.map((lead) => (
              <tr key={lead.id} className="transition-colors hover:bg-surface-sunken">
                <td className="px-4 py-3">
                  <Link href={`/leads/${lead.id}`} prefetch={false} className="font-medium text-ink hover:underline">
                    {lead.company_or_name}
                  </Link>
                </td>
                <td className="px-4 py-3 text-ink-soft">{lead.city ?? "-"}</td>
                <td className="px-4 py-3 text-ink-soft" style={{ fontVariantNumeric: "tabular-nums" }}>
                  {lead.budget_min ?? "?"}-{lead.budget_max ?? "?"} {lead.budget_currency}
                </td>
                <td className="px-4 py-3 text-ink-soft" style={{ fontVariantNumeric: "tabular-nums" }}>{lead.seriousness_score}</td>
                <td className="px-4 py-3">
                  <span className={pillClasses(statusTone[lead.status])}>
                    {statusLabel[lead.status] ?? lead.status}
                  </span>
                </td>
              </tr>
            ))}
            {leads?.length === 0 ? (
              <tr>
                <td colSpan={5}>
                  <EmptyState icon={Users} title="Henüz müşteri eklenmedi" description="Yeni müşteri ekleyerek takibe başlayın." />
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}

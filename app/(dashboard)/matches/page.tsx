import Link from "next/link";
import { ChevronRight, GitCompareArrows } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { rankVehiclesForLead } from "@/lib/services/matching";
import { selectVehicleForLeadAction } from "./actions";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { cardClass } from "@/lib/ui";
import MatchManager from "./match-manager";

export default async function MatchesPage({
  searchParams,
}: {
  searchParams: Promise<{ lead_id?: string }>;
}) {
  const { lead_id } = await searchParams;
  const supabase = await createClient();

  if (!lead_id) {
    const [{ data: leads }, { data: savedMatches }] = await Promise.all([supabase
      .from("leads")
      .select("*")
      .neq("status", "closed_won")
      .neq("status", "closed_lost")
      .order("created_at", { ascending: false }), supabase
      .from("matches")
      .select("id,match_score,created_at,leads(company_or_name),vehicles(brand,model,year)")
      .order("created_at", { ascending: false })]);

    return (
      <div>
        <PageHeader eyebrow="Eşleştirme" title="Eşleştirme" description="Eşleştirme yapmak için bir müşteri seçin." />
        <div className={`mb-6 overflow-hidden ${cardClass}`}>
          <ul className="divide-y divide-line-soft">
            {leads?.map((lead) => (
              <li key={lead.id}>
                <Link
                  href={`/matches?lead_id=${lead.id}`}
                  prefetch={false}
                  className="flex items-center justify-between px-4 py-3 text-sm transition-colors hover:bg-surface-sunken"
                >
                  <span>
                    <span className="font-medium text-ink">{lead.company_or_name}</span>
                    <span className="ml-2 text-ink-faint">
                      {lead.desired_vehicle_type ?? "belirtilmemiş"} · {lead.budget_min ?? "?"}-
                      {lead.budget_max ?? "?"} {lead.budget_currency}
                    </span>
                  </span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-ink-faint" strokeWidth={1.75} />
                </Link>
              </li>
            ))}
          </ul>
          {leads?.length === 0 ? (
            <EmptyState icon={GitCompareArrows} title="Eşleştirilecek müşteri yok" description="Kapanmamış müşteri talebi bulunduğunda burada listelenir." />
          ) : null}
        </div>
        <div className={cardClass}>
          <div className="border-b border-line-soft px-5 py-4"><h2 className="font-medium text-ink">Kaydedilmiş eşleştirmeler</h2></div>
          <div className="divide-y divide-line-soft">
            {(savedMatches ?? []).map((match) => {
              const lead = match.leads as unknown as { company_or_name: string } | null;
              const vehicle = match.vehicles as unknown as { brand: string; model: string; year: number | null } | null;
              return <div key={match.id} className="flex flex-col justify-between gap-3 px-5 py-4 sm:flex-row sm:items-center"><div><p className="font-medium text-ink">{lead?.company_or_name ?? "Müşteri"} ↔ {vehicle ? `${vehicle.brand} ${vehicle.model}` : "Araç"}</p><p className="text-xs text-ink-faint">{vehicle?.year ?? "Yıl bilinmiyor"} · {new Date(match.created_at).toLocaleString("tr-TR")}</p></div><MatchManager id={match.id} score={match.match_score} /></div>;
            })}
            {(savedMatches ?? []).length === 0 ? <EmptyState icon={GitCompareArrows} title="Kaydedilmiş eşleştirme yok" description="Bir müşteri için araç seçtiğinizde burada yönetilebilir." /> : null}
          </div>
        </div>
      </div>
    );
  }

  const { data: lead, error: leadError } = await supabase
    .from("leads")
    .select("*")
    .eq("id", lead_id)
    .single();
  if (leadError || !lead) {
    return <p className="text-sm text-danger">Müşteri bulunamadı.</p>;
  }

  const { data: vehicles } = await supabase.from("vehicles").select("*");
  const ranked = rankVehiclesForLead(lead, vehicles ?? []);

  return (
    <div>
      <PageHeader
        eyebrow="Eşleştirme"
        title={`${lead.company_or_name} için uygun araçlar`}
        description={`İstenen: ${lead.desired_vehicle_type ?? "belirtilmemiş"} · Bütçe: ${lead.budget_min ?? "?"}-${lead.budget_max ?? "?"} ${lead.budget_currency}`}
      />

      <div className="space-y-3">
        {ranked.map(({ vehicle, score, reasoning }) => (
          <div
            key={vehicle.id}
            className={`flex items-center justify-between ${cardClass} border-l-[3px] p-4 transition-shadow hover:shadow-md`}
            style={{ borderLeftColor: score >= 70 ? "#15803D" : score >= 40 ? "#B45309" : "#D9D4C9" }}
          >
            <div>
              <p className="font-medium text-ink">
                {vehicle.brand} {vehicle.model} ({vehicle.year ?? "?"})
              </p>
              <p className="text-sm text-ink-faint" style={{ fontVariantNumeric: "tabular-nums" }}>
                {vehicle.price?.toLocaleString("tr-TR")} {vehicle.currency} · {vehicle.mileage_km?.toLocaleString("tr-TR") ?? "?"} km
              </p>
              <p className="mt-1 text-xs text-ink-faint">
                {reasoning.map((r) => `${r.matched ? "✓" : "✗"} ${r.criterion}`).join("  ")}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span
                className={`rounded-full px-3 py-1 text-sm font-medium ${
                  score >= 70
                    ? "bg-success-wash text-success"
                    : score >= 40
                      ? "bg-warning-wash text-warning"
                      : "bg-surface-sunken text-ink-soft"
                }`}
              >
                %{score}
              </span>
              <form
                action={async () => {
                  "use server";
                  await selectVehicleForLeadAction(lead.id, vehicle.id);
                }}
              >
                <button
                  type="submit"
                  className="rounded-md bg-brand px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-ink"
                >
                  Bu aracı seç
                </button>
              </form>
            </div>
          </div>
        ))}
        {ranked.length === 0 ? (
          <div className={cardClass}>
            <EmptyState icon={GitCompareArrows} title="Uygun araç bulunamadı" description="Filtre kriterlerine uyan bir araç envanterde yok." />
          </div>
        ) : null}
      </div>
    </div>
  );
}

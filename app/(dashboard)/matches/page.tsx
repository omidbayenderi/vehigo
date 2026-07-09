import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { rankVehiclesForLead } from "@/lib/services/matching";
import { selectVehicleForLeadAction } from "./actions";

export default async function MatchesPage({
  searchParams,
}: {
  searchParams: Promise<{ lead_id?: string }>;
}) {
  const { lead_id } = await searchParams;
  const supabase = await createClient();

  if (!lead_id) {
    const { data: leads } = await supabase
      .from("leads")
      .select("*")
      .neq("status", "closed_won")
      .neq("status", "closed_lost")
      .order("created_at", { ascending: false });

    return (
      <div>
        <h1 className="mb-6 text-2xl font-serif font-semibold text-ink">Eşleştirme</h1>
        <p className="mb-4 text-sm text-ink-soft">Eşleştirme yapmak için bir müşteri seçin.</p>
        <div className="overflow-hidden rounded-lg border border-line-soft bg-white">
          <ul className="divide-y divide-line-soft">
            {leads?.map((lead) => (
              <li key={lead.id}>
                <Link
                  href={`/matches?lead_id=${lead.id}`}
                  prefetch={false}
                  className="block px-4 py-3 text-sm hover:bg-paper"
                >
                  <span className="font-medium text-ink">{lead.company_or_name}</span>
                  <span className="ml-2 text-ink-faint">
                    {lead.desired_vehicle_type ?? "belirtilmemiş"} · {lead.budget_min ?? "?"}-
                    {lead.budget_max ?? "?"} {lead.budget_currency}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
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
      <h1 className="mb-1 text-2xl font-serif font-semibold text-ink">{lead.company_or_name} için uygun araçlar</h1>
      <p className="mb-6 text-sm text-ink-faint">
        İstenen: {lead.desired_vehicle_type ?? "belirtilmemiş"} · Bütçe: {lead.budget_min ?? "?"}-
        {lead.budget_max ?? "?"} {lead.budget_currency}
      </p>

      <div className="space-y-3">
        {ranked.map(({ vehicle, score, reasoning }) => (
          <div
            key={vehicle.id}
            className="flex items-center justify-between rounded-lg border border-line-soft bg-white p-4"
          >
            <div>
              <p className="font-medium text-ink">
                {vehicle.brand} {vehicle.model} ({vehicle.year ?? "?"})
              </p>
              <p className="text-sm text-ink-faint">
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
                  className="rounded-md bg-brand px-3 py-2 text-sm font-medium text-white hover:bg-brand-ink"
                >
                  Bu aracı seç
                </button>
              </form>
            </div>
          </div>
        ))}
        {ranked.length === 0 ? (
          <p className="text-sm text-ink-faint">Uygun araç bulunamadı.</p>
        ) : null}
      </div>
    </div>
  );
}

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
        <h1 className="mb-6 text-2xl font-semibold text-zinc-900">Eşleştirme</h1>
        <p className="mb-4 text-sm text-zinc-600">Eşleştirme yapmak için bir müşteri seçin.</p>
        <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white">
          <ul className="divide-y divide-zinc-100">
            {leads?.map((lead) => (
              <li key={lead.id}>
                <Link
                  href={`/matches?lead_id=${lead.id}`}
                  className="block px-4 py-3 text-sm hover:bg-zinc-50"
                >
                  <span className="font-medium text-zinc-900">{lead.company_or_name}</span>
                  <span className="ml-2 text-zinc-500">
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
    return <p className="text-sm text-red-600">Müşteri bulunamadı.</p>;
  }

  const { data: vehicles } = await supabase.from("vehicles").select("*");
  const ranked = rankVehiclesForLead(lead, vehicles ?? []);

  return (
    <div>
      <h1 className="mb-1 text-2xl font-semibold text-zinc-900">{lead.company_or_name} için uygun araçlar</h1>
      <p className="mb-6 text-sm text-zinc-500">
        İstenen: {lead.desired_vehicle_type ?? "belirtilmemiş"} · Bütçe: {lead.budget_min ?? "?"}-
        {lead.budget_max ?? "?"} {lead.budget_currency}
      </p>

      <div className="space-y-3">
        {ranked.map(({ vehicle, score, reasoning }) => (
          <div
            key={vehicle.id}
            className="flex items-center justify-between rounded-lg border border-zinc-200 bg-white p-4"
          >
            <div>
              <p className="font-medium text-zinc-900">
                {vehicle.brand} {vehicle.model} ({vehicle.year ?? "?"})
              </p>
              <p className="text-sm text-zinc-500">
                {vehicle.price?.toLocaleString("tr-TR")} {vehicle.currency} · {vehicle.mileage_km?.toLocaleString("tr-TR") ?? "?"} km
              </p>
              <p className="mt-1 text-xs text-zinc-400">
                {reasoning.map((r) => `${r.matched ? "✓" : "✗"} ${r.criterion}`).join("  ")}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span
                className={`rounded-full px-3 py-1 text-sm font-medium ${
                  score >= 70
                    ? "bg-green-100 text-green-700"
                    : score >= 40
                      ? "bg-amber-100 text-amber-700"
                      : "bg-zinc-100 text-zinc-600"
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
                  className="rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-700"
                >
                  Bu aracı seç
                </button>
              </form>
            </div>
          </div>
        ))}
        {ranked.length === 0 ? (
          <p className="text-sm text-zinc-500">Uygun araç bulunamadı.</p>
        ) : null}
      </div>
    </div>
  );
}

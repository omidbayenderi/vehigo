import { createClient } from "@/lib/supabase/server";
import OfferForm from "./offer-form";

export default async function NewOfferPage({
  searchParams,
}: {
  searchParams: Promise<{ lead_id?: string; vehicle_id?: string }>;
}) {
  const { lead_id, vehicle_id } = await searchParams;
  const supabase = await createClient();

  if (!lead_id || !vehicle_id) {
    return (
      <p className="text-sm text-ink-soft">
        Teklif oluşturmak için önce{" "}
        <a href="/matches" className="underline">
          eşleştirme
        </a>{" "}
        sayfasından bir müşteri ve araç seçin.
      </p>
    );
  }

  const { data: lead } = await supabase.from("leads").select("*").eq("id", lead_id).single();
  const { data: vehicle } = await supabase.from("vehicles").select("*").eq("id", vehicle_id).single();

  if (!lead || !vehicle) {
    return <p className="text-sm text-danger">Müşteri veya araç bulunamadı.</p>;
  }

  return (
    <div className="max-w-2xl">
      <h1 className="mb-6 text-2xl font-serif font-semibold text-ink">Yeni teklif</h1>
      <OfferForm
        leadId={lead.id}
        vehicleId={vehicle.id}
        leadName={lead.company_or_name}
        vehicleLabel={`${vehicle.brand} ${vehicle.model} (${vehicle.year ?? "?"})`}
        defaultPrice={vehicle.price ?? 0}
        defaultCurrency={vehicle.currency}
      />
    </div>
  );
}

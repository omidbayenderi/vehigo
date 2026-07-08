import { createClient } from "@/lib/supabase/server";
import { buildOfferMessageDraft } from "@/lib/services/messages";
import NewDraftForm from "./new-draft-form";

export default async function NewMessageDraftPage({
  searchParams,
}: {
  searchParams: Promise<{ lead_id?: string; offer_id?: string }>;
}) {
  const { lead_id, offer_id } = await searchParams;
  const supabase = await createClient();

  if (!lead_id) {
    return <p className="text-sm text-zinc-600">Mesaj taslağı oluşturmak için bir müşteri bağlamı gerekli.</p>;
  }

  const { data: lead } = await supabase.from("leads").select("*").eq("id", lead_id).single();
  if (!lead) {
    return <p className="text-sm text-red-600">Müşteri bulunamadı.</p>;
  }

  let defaultText = "";
  if (offer_id) {
    const { data: offer } = await supabase.from("offers").select("*").eq("id", offer_id).single();
    const { data: vehicle } = offer?.vehicle_id
      ? await supabase.from("vehicles").select("*").eq("id", offer.vehicle_id).single()
      : { data: null };

    if (offer && vehicle) {
      defaultText = buildOfferMessageDraft({
        customerName: lead.company_or_name,
        vehicleBrand: vehicle.brand ?? "-",
        vehicleModel: vehicle.model ?? "-",
        vehicleYear: vehicle.year,
        finalCustomerPrice: offer.final_customer_price,
        currency: offer.currency,
        validityDate: offer.validity_date,
      });
    }
  }

  return (
    <div className="max-w-xl">
      <h1 className="mb-6 text-2xl font-semibold text-zinc-900">Mesaj taslağı — {lead.company_or_name}</h1>
      <NewDraftForm leadId={lead.id} offerId={offer_id} defaultText={defaultText} />
    </div>
  );
}

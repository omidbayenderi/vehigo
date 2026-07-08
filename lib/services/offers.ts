import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { offerCostSchema } from "@/lib/validation/schemas";

type Client = SupabaseClient<Database>;
type OfferInsert = Database["public"]["Tables"]["offers"]["Insert"];

export type OfferCostInput = {
  baseVehiclePrice: number;
  exportCompanyFee: number;
  transportCost: number;
  insuranceCost: number;
  iranCustomsEstimate: number;
  internalServiceFee: number;
  commissionType: "fixed" | "percentage";
  commissionValue: number;
};

export type OfferCostResult = {
  subtotal: number;
  commissionAmount: number;
  finalCustomerPrice: number;
};

/**
 * commissionValue: 'fixed' ise tutar, 'percentage' ise subtotal üzerinden yüzde.
 * subtotal = araç fiyatı + tüm masraf kalemleri (komisyon hariç).
 */
export function calculateOffer(input: OfferCostInput): OfferCostResult {
  const subtotal =
    input.baseVehiclePrice +
    input.exportCompanyFee +
    input.transportCost +
    input.insuranceCost +
    input.iranCustomsEstimate +
    input.internalServiceFee;

  const commissionAmount =
    input.commissionType === "percentage"
      ? Math.round(subtotal * (input.commissionValue / 100) * 100) / 100
      : input.commissionValue;

  const finalCustomerPrice = Math.round((subtotal + commissionAmount) * 100) / 100;

  return { subtotal, commissionAmount, finalCustomerPrice };
}

export async function createOffer(supabase: Client, input: Record<string, unknown>, userId: string) {
  const parsed = offerCostSchema.parse(input);
  const { commissionAmount, finalCustomerPrice } = calculateOffer({
    baseVehiclePrice: parsed.base_vehicle_price,
    exportCompanyFee: parsed.export_company_fee,
    transportCost: parsed.transport_cost,
    insuranceCost: parsed.insurance_cost,
    iranCustomsEstimate: parsed.iran_customs_estimate,
    internalServiceFee: parsed.internal_service_fee,
    commissionType: parsed.commission_type,
    commissionValue: parsed.commission_value,
  });

  const row: OfferInsert = {
    ...parsed,
    commission_amount_calculated: commissionAmount,
    final_customer_price: finalCustomerPrice,
    created_by: userId,
  };

  const { data, error } = await supabase.from("offers").insert(row).select().single();
  if (error) throw new Error(error.message);

  await supabase.from("compliance_checklist").insert({ offer_id: data.id });

  return data;
}

export async function updateOfferCosts(supabase: Client, id: string, input: Record<string, unknown>) {
  const parsed = offerCostSchema.partial().parse(input);

  const { data: existing, error: fetchError } = await supabase
    .from("offers")
    .select("*")
    .eq("id", id)
    .single();
  if (fetchError) throw new Error(fetchError.message);

  const merged = { ...existing, ...parsed };
  const { commissionAmount, finalCustomerPrice } = calculateOffer({
    baseVehiclePrice: merged.base_vehicle_price ?? 0,
    exportCompanyFee: merged.export_company_fee,
    transportCost: merged.transport_cost,
    insuranceCost: merged.insurance_cost,
    iranCustomsEstimate: merged.iran_customs_estimate,
    internalServiceFee: merged.internal_service_fee,
    commissionType: merged.commission_type,
    commissionValue: merged.commission_value,
  });

  const { data, error } = await supabase
    .from("offers")
    .update({
      ...parsed,
      commission_amount_calculated: commissionAmount,
      final_customer_price: finalCustomerPrice,
    })
    .eq("id", id)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function getOffer(supabase: Client, id: string) {
  const { data, error } = await supabase.from("offers").select("*").eq("id", id).single();
  if (error) throw new Error(error.message);

  const { data: lead } = await supabase.from("leads").select("*").eq("id", data.lead_id ?? "").maybeSingle();
  const { data: vehicle } = await supabase
    .from("vehicles")
    .select("*")
    .eq("id", data.vehicle_id ?? "")
    .maybeSingle();
  const { data: compliance } = await supabase
    .from("compliance_checklist")
    .select("*")
    .eq("offer_id", id)
    .maybeSingle();

  return { ...data, lead, vehicle, compliance };
}

export async function listOffers(supabase: Client) {
  const { data, error } = await supabase.from("offers").select("*").order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data;
}

export async function savePdfPath(supabase: Client, id: string, pdfStoragePath: string) {
  const { error } = await supabase.from("offers").update({ pdf_storage_path: pdfStoragePath }).eq("id", id);
  if (error) throw new Error(error.message);
}

/**
 * PDF müşteriyle paylaşıldıktan sonra kullanıcının elle onayladığı adım —
 * sistem hiçbir zaman kendiliğinden "gönderildi" durumuna geçmez.
 */
export async function confirmOfferSent(supabase: Client, id: string, performedBy: string) {
  const { data: offer, error } = await supabase
    .from("offers")
    .update({ status: "sent" })
    .eq("id", id)
    .select()
    .single();
  if (error) throw new Error(error.message);

  if (offer.lead_id) {
    await supabase.from("leads").update({ status: "offer_sent" }).eq("id", offer.lead_id);
    await supabase.from("lead_activity_log").insert({
      lead_id: offer.lead_id,
      activity_type: "offer_sent",
      detail: "Teklif PDF'i müşteriyle paylaşıldı",
      performed_by: performedBy,
    });
  }

  return offer;
}

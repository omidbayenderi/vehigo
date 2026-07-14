import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { offerCostSchema, offerOutcomeSchema } from "@/lib/validation/schemas";
import { partialUpdateFields } from "@/lib/utils";

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
  const parsed = partialUpdateFields(offerCostSchema, input);

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

export async function deleteOffer(supabase: Client, id: string) {
  const { data, error } = await supabase.from("offers").delete().eq("id", id).select("id");
  if (error) throw new Error(error.message);
  // RLS silently filters out rows the caller isn't allowed to delete rather than
  // erroring, so an empty result means "not deleted", not "already gone".
  if (!data || data.length === 0) {
    throw new Error("Bu teklifi silme izniniz yok veya teklif zaten silinmiş.");
  }
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
  const { data: exportScenarioResult } = data.export_scenario_result_id
    ? await supabase.from("export_scenario_results").select("*").eq("id", data.export_scenario_result_id).maybeSingle()
    : { data: null };

  return { ...data, lead, vehicle, compliance, exportScenarioResult };
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

/**
 * Kullanıcının işlem kapandıktan sonra elle kaydettiği gerçek maliyet/gelir —
 * beklenen kâr (commission_amount_calculated) ile karşılaştırmak için.
 */
export async function closeOfferOutcome(supabase: Client, id: string, input: Record<string, unknown>) {
  const parsed = offerOutcomeSchema.parse(input);
  const { data, error } = await supabase
    .from("offers")
    .update({ ...parsed, closed_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export type ProfitReportRow = {
  key: string;
  country: string;
  source: string;
  model: string;
  dealCount: number;
  wonCount: number;
  lostCount: number;
  expectedProfitSum: number;
  realizedProfitSum: number;
  variance: number;
};

type ClosedOfferInput = Pick<
  Database["public"]["Tables"]["offers"]["Row"],
  "vehicle_id" | "closed_outcome" | "commission_amount_calculated" | "actual_revenue" | "actual_total_cost"
>;
type VehicleGroupingInput = { id: string; seller_country: string | null; source_site: string | null; brand: string | null; model: string | null };

export function aggregateProfitReport(
  offers: ClosedOfferInput[],
  vehicleById: Map<string, VehicleGroupingInput>,
): ProfitReportRow[] {
  const groups = new Map<string, ProfitReportRow>();
  for (const offer of offers) {
    const vehicle = offer.vehicle_id ? vehicleById.get(offer.vehicle_id) : undefined;
    const country = vehicle?.seller_country ?? "Bilinmiyor";
    const source = vehicle?.source_site ?? "Bilinmiyor";
    const model = [vehicle?.brand, vehicle?.model].filter(Boolean).join(" ") || "Bilinmiyor";
    const key = `${country}__${source}__${model}`;

    const row = groups.get(key) ?? {
      key,
      country,
      source,
      model,
      dealCount: 0,
      wonCount: 0,
      lostCount: 0,
      expectedProfitSum: 0,
      realizedProfitSum: 0,
      variance: 0,
    };

    row.dealCount++;
    if (offer.closed_outcome === "won") {
      row.wonCount++;
      row.expectedProfitSum += offer.commission_amount_calculated ?? 0;
      if (offer.actual_revenue !== null && offer.actual_total_cost !== null) {
        row.realizedProfitSum += offer.actual_revenue - offer.actual_total_cost;
      }
    } else {
      row.lostCount++;
    }
    row.variance = Math.round((row.realizedProfitSum - row.expectedProfitSum) * 100) / 100;

    groups.set(key, row);
  }

  return [...groups.values()].sort((a, b) => b.realizedProfitSum - a.realizedProfitSum);
}

export async function getProfitReport(supabase: Client): Promise<ProfitReportRow[]> {
  const { data: offers, error } = await supabase.from("offers").select("*").not("closed_outcome", "is", null);
  if (error) throw new Error(error.message);
  if (!offers || offers.length === 0) return [];

  const vehicleIds = [...new Set(offers.map((o) => o.vehicle_id).filter((id): id is string => Boolean(id)))];
  const { data: vehicles, error: vehiclesError } =
    vehicleIds.length > 0
      ? await supabase.from("vehicles").select("id, seller_country, source_site, brand, model").in("id", vehicleIds)
      : { data: [], error: null };
  if (vehiclesError) throw new Error(vehiclesError.message);
  const vehicleById = new Map((vehicles ?? []).map((v) => [v.id, v]));

  return aggregateProfitReport(offers, vehicleById);
}

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { listingPurchaseChecklistSchema } from "@/lib/validation/schemas";
import { partialUpdateFields } from "@/lib/utils";

type Client = SupabaseClient<Database>;

export async function getOrCreatePurchaseChecklist(supabase: Client, listingId: string) {
  const { data: existing, error: fetchError } = await supabase
    .from("listing_purchase_checklist")
    .select("*")
    .eq("listing_id", listingId)
    .maybeSingle();
  if (fetchError) throw new Error(fetchError.message);
  if (existing) return existing;

  const { data, error } = await supabase
    .from("listing_purchase_checklist")
    .insert({ listing_id: listingId })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function updatePurchaseChecklist(
  supabase: Client,
  listingId: string,
  input: Record<string, unknown>,
  reviewedBy: string,
) {
  const parsed = partialUpdateFields(listingPurchaseChecklistSchema.omit({ listing_id: true }), input);

  const { data, error } = await supabase
    .from("listing_purchase_checklist")
    .update({ ...parsed, reviewed_by: reviewedBy, reviewed_at: new Date().toISOString() })
    .eq("listing_id", listingId)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export function calculateAcquisitionCost(
  listingPrice: number | null,
  checklist: Pick<
    Database["public"]["Tables"]["listing_purchase_checklist"]["Row"],
    "estimated_transport_cost" | "estimated_insurance_cost" | "estimated_customs_cost" | "estimated_prep_cost"
  >,
) {
  const base = listingPrice ?? 0;
  const total =
    base +
    checklist.estimated_transport_cost +
    checklist.estimated_insurance_cost +
    checklist.estimated_customs_cost +
    checklist.estimated_prep_cost;
  return Math.round(total * 100) / 100;
}

"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { updatePurchaseChecklist } from "@/lib/services/purchase-checklist";
import { logAudit } from "@/lib/services/audit";
import { formDataToObject } from "@/lib/utils";
import type { PurchaseChecklistField } from "./purchase-checklist";

export async function updatePurchaseChecklistFieldAction(
  listingId: string,
  field: PurchaseChecklistField,
  value: boolean | string,
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  await updatePurchaseChecklist(supabase, listingId, { [field]: value }, user.id);
  await logAudit(supabase, user.id, "purchase_checklist_update", "market_listing", listingId, { field, value });
  revalidatePath("/shortlist");
}

export async function updateAcquisitionCostAction(listingId: string, formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const input = formDataToObject(formData);

  await updatePurchaseChecklist(supabase, listingId, input, user.id);
  await logAudit(supabase, user.id, "acquisition_cost_update", "market_listing", listingId, {
    estimated_transport_cost: String(formData.get("estimated_transport_cost") ?? ""),
    estimated_insurance_cost: String(formData.get("estimated_insurance_cost") ?? ""),
    estimated_customs_cost: String(formData.get("estimated_customs_cost") ?? ""),
    estimated_prep_cost: String(formData.get("estimated_prep_cost") ?? ""),
  });
  revalidatePath("/shortlist");
}

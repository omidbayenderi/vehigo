"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createOffer, updateOfferCosts, confirmOfferSent, closeOfferOutcome } from "@/lib/services/offers";
import { updateComplianceChecklist } from "@/lib/services/compliance";
import { logAudit } from "@/lib/services/audit";
import { formDataToObject } from "@/lib/utils";
import type { ComplianceField } from "./compliance-checklist";

export type FormState = { error?: string };

export async function createOfferAction(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const input = formDataToObject(formData);

  try {
    const offer = await createOffer(supabase, input, user.id);
    await logAudit(supabase, user.id, "create", "offer", offer.id);
    revalidatePath("/offers");
    redirect(`/offers/${offer.id}`);
  } catch (err) {
    if (err instanceof Error && err.message !== "NEXT_REDIRECT") {
      return { error: err.message };
    }
    throw err;
  }
}

export async function updateOfferCostsAction(
  id: string,
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const input = formDataToObject(formData);

  try {
    await updateOfferCosts(supabase, id, input);
    await logAudit(supabase, user.id, "update", "offer", id);
    revalidatePath(`/offers/${id}`);
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Bilinmeyen hata" };
  }
}

export async function toggleComplianceFieldAction(
  offerId: string,
  field: ComplianceField,
  value: boolean,
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  await updateComplianceChecklist(supabase, offerId, { [field]: value }, user.id);
  await logAudit(supabase, user.id, "compliance_update", "offer", offerId, { field, value });
  revalidatePath(`/offers/${offerId}`);
}

export async function confirmOfferSentAction(offerId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  await confirmOfferSent(supabase, offerId, user.id);
  await logAudit(supabase, user.id, "confirm_sent", "offer", offerId);
  revalidatePath(`/offers/${offerId}`);
  revalidatePath("/leads");
}

export async function closeOfferOutcomeAction(
  id: string,
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const input = formDataToObject(formData);

  try {
    await closeOfferOutcome(supabase, id, input);
    await logAudit(supabase, user.id, "close_outcome", "offer", id, {
      closed_outcome: String(formData.get("closed_outcome") ?? ""),
      actual_total_cost: String(formData.get("actual_total_cost") ?? ""),
      actual_revenue: String(formData.get("actual_revenue") ?? ""),
    });
    revalidatePath(`/offers/${id}`);
    revalidatePath("/reports");
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Bilinmeyen hata" };
  }
}

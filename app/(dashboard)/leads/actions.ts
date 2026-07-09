"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createLead, updateLead, setLeadStatus, addLeadNote } from "@/lib/services/leads";
import { logAudit } from "@/lib/services/audit";
import { formDataToObject } from "@/lib/utils";
import type { LeadStatus } from "@/lib/supabase/types";

export type FormState = { error?: string };

export async function createLeadAction(
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
    const lead = await createLead(supabase, input, user.id);
    await logAudit(supabase, user.id, "create", "lead", lead.id);
    revalidatePath("/leads");
    redirect(`/leads/${lead.id}`);
  } catch (err) {
    if (err instanceof Error && err.message !== "NEXT_REDIRECT") {
      return { error: err.message };
    }
    throw err;
  }
}

export async function updateLeadAction(
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
    await updateLead(supabase, id, input);
    await logAudit(supabase, user.id, "update", "lead", id);
    revalidatePath("/leads");
    revalidatePath(`/leads/${id}`);
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Bilinmeyen hata" };
  }
}

export async function changeLeadStatusAction(id: string, status: LeadStatus) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  await setLeadStatus(supabase, id, status, user.id);
  revalidatePath(`/leads/${id}`);
  revalidatePath("/leads");
}

export async function addLeadNoteAction(
  id: string,
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const note = String(formData.get("note") ?? "").trim();
  if (!note) return { error: "Not boş olamaz" };

  await addLeadNote(supabase, id, note, user.id);
  revalidatePath(`/leads/${id}`);
  return {};
}

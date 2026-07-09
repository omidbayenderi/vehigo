"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  createMessageDraft,
  updateDraftText,
  approveDraft,
  markDraftSent,
  discardDraft,
} from "@/lib/services/messages";
import { logAudit } from "@/lib/services/audit";
import { formDataToObject } from "@/lib/utils";

export type FormState = { error?: string };

export async function createMessageDraftAction(
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
    const draft = await createMessageDraft(supabase, input);
    await logAudit(supabase, user.id, "create", "message_draft", draft.id);
    revalidatePath("/messages");
    redirect(`/messages/${draft.id}`);
  } catch (err) {
    if (err instanceof Error && err.message !== "NEXT_REDIRECT") {
      return { error: err.message };
    }
    throw err;
  }
}

export async function saveDraftTextAction(id: string, text: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  await updateDraftText(supabase, id, text);
  revalidatePath(`/messages/${id}`);
}

export async function approveDraftAction(id: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  await approveDraft(supabase, id, user.id);
  await logAudit(supabase, user.id, "approve", "message_draft", id);
  revalidatePath(`/messages/${id}`);
  revalidatePath("/messages");
}

export async function markDraftSentAction(id: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  await markDraftSent(supabase, id, user.id);
  await logAudit(supabase, user.id, "mark_sent", "message_draft", id);
  revalidatePath(`/messages/${id}`);
  revalidatePath("/messages");
}

export async function discardDraftAction(id: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  await discardDraft(supabase, id);
  await logAudit(supabase, user.id, "discard", "message_draft", id);
  revalidatePath(`/messages/${id}`);
  revalidatePath("/messages");
}

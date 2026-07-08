import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { messageDraftSchema } from "@/lib/validation/schemas";

/**
 * Bu servis SADECE taslak metin üretir/saklar. Hiçbir dış API'ye
 * (WhatsApp Business API, Telegram Bot API vb.) gönderim çağrısı yapmaz —
 * "insan onaylı" prensibi kod seviyesinde burada garanti edilir.
 */

type Client = SupabaseClient<Database>;
type MessageDraftInsert = Database["public"]["Tables"]["message_drafts"]["Insert"];

export function buildOfferMessageDraft(input: {
  customerName: string;
  vehicleBrand: string;
  vehicleModel: string;
  vehicleYear: number | null;
  finalCustomerPrice: number | null;
  currency: string;
  validityDate: string | null;
}): string {
  const price = input.finalCustomerPrice
    ? `${input.finalCustomerPrice.toLocaleString("en-US")} ${input.currency}`
    : "-";
  const validity = input.validityDate ? ` (اعتبار تا ${input.validityDate})` : "";

  return [
    `سلام ${input.customerName} عزیز،`,
    ``,
    `پیشنهاد قیمت برای ${input.vehicleBrand} ${input.vehicleModel} (${input.vehicleYear ?? "-"}) آماده شد.`,
    `قیمت نهایی: ${price}${validity}`,
    ``,
    `فایل پیش‌فاکتور را به پیوست ارسال می‌کنم. برای هرگونه سوال در خدمت شما هستم.`,
  ].join("\n");
}

export async function listMessageDrafts(supabase: Client) {
  const { data, error } = await supabase
    .from("message_drafts")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data;
}

export async function createMessageDraft(supabase: Client, input: Record<string, unknown>) {
  const parsed = messageDraftSchema.parse(input);
  const row: MessageDraftInsert = parsed;
  const { data, error } = await supabase.from("message_drafts").insert(row).select().single();
  if (error) throw new Error(error.message);
  return data;
}

export async function updateDraftText(supabase: Client, id: string, text: string) {
  const { error } = await supabase.from("message_drafts").update({ draft_text: text }).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function approveDraft(supabase: Client, id: string, approvedBy: string) {
  const { error } = await supabase
    .from("message_drafts")
    .update({ status: "approved", approved_by: approvedBy, approved_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export async function markDraftSent(supabase: Client, id: string, performedBy: string) {
  const { data: draft, error } = await supabase
    .from("message_drafts")
    .update({ status: "sent" })
    .eq("id", id)
    .select()
    .single();
  if (error) throw new Error(error.message);

  await supabase.from("lead_activity_log").insert({
    lead_id: draft.lead_id,
    activity_type: "manual_contact",
    detail: `${draft.channel} mesajı kullanıcı tarafından manuel gönderildi`,
    performed_by: performedBy,
  });
}

export async function discardDraft(supabase: Client, id: string) {
  const { error } = await supabase.from("message_drafts").update({ status: "discarded" }).eq("id", id);
  if (error) throw new Error(error.message);
}

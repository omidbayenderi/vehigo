import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, LeadStatus } from "@/lib/supabase/types";
import { leadSchema } from "@/lib/validation/schemas";
import { partialUpdateFields } from "@/lib/utils";

type Client = SupabaseClient<Database>;
type LeadInsert = Database["public"]["Tables"]["leads"]["Insert"];

export async function listLeads(
  supabase: Client,
  filters: { status?: string; search?: string } = {},
) {
  let query = supabase.from("leads").select("*").order("created_at", { ascending: false });

  if (filters.status) {
    query = query.eq("status", filters.status as LeadStatus);
  }
  if (filters.search) {
    query = query.ilike("company_or_name", `%${filters.search}%`);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data;
}

export async function getLead(supabase: Client, id: string) {
  const { data: lead, error } = await supabase.from("leads").select("*").eq("id", id).single();
  if (error) throw new Error(error.message);

  const { data: activity, error: activityError } = await supabase
    .from("lead_activity_log")
    .select("*")
    .eq("lead_id", id)
    .order("created_at", { ascending: false });
  if (activityError) throw new Error(activityError.message);

  return { ...lead, activity: activity ?? [] };
}

export function suggestSeriousnessScore(input: {
  budget_min?: number | null;
  budget_max?: number | null;
  phone_whatsapp?: string | null;
  desired_vehicle_type?: string | null;
  last_contact_date?: string | null;
}): number {
  let score = 0;
  if (input.budget_min || input.budget_max) score += 40;
  if (input.phone_whatsapp) score += 30;
  if (input.desired_vehicle_type) score += 20;
  if (input.last_contact_date) score += 10;
  return Math.min(score, 100);
}

export async function createLead(supabase: Client, input: Record<string, unknown>, userId: string) {
  const parsed = leadSchema.parse(input);
  const row: LeadInsert = { ...parsed, created_by: userId };
  const { data, error } = await supabase.from("leads").insert(row).select().single();
  if (error) throw new Error(error.message);
  return data;
}

export async function updateLead(supabase: Client, id: string, input: Record<string, unknown>) {
  const parsed = partialUpdateFields(leadSchema, input);
  const { data, error } = await supabase.from("leads").update(parsed).eq("id", id).select().single();
  if (error) throw new Error(error.message);
  return data;
}

export async function setLeadStatus(
  supabase: Client,
  id: string,
  status: LeadStatus,
  performedBy: string,
) {
  const { error } = await supabase.from("leads").update({ status }).eq("id", id);
  if (error) throw new Error(error.message);

  await supabase.from("lead_activity_log").insert({
    lead_id: id,
    activity_type: "status_change",
    detail: `Durum "${status}" olarak güncellendi`,
    performed_by: performedBy,
  });
}

export async function addLeadNote(supabase: Client, id: string, note: string, performedBy: string) {
  const { error } = await supabase.from("lead_activity_log").insert({
    lead_id: id,
    activity_type: "note",
    detail: note,
    performed_by: performedBy,
  });
  if (error) throw new Error(error.message);
}

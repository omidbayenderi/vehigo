import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { complianceChecklistSchema } from "@/lib/validation/schemas";
import { partialUpdateFields } from "@/lib/utils";

type Client = SupabaseClient<Database>;

export async function updateComplianceChecklist(
  supabase: Client,
  offerId: string,
  input: Record<string, unknown>,
  reviewedBy: string,
) {
  const parsed = partialUpdateFields(complianceChecklistSchema.omit({ offer_id: true }), input);

  const { data, error } = await supabase
    .from("compliance_checklist")
    .update({ ...parsed, reviewed_by: reviewedBy, reviewed_at: new Date().toISOString() })
    .eq("offer_id", offerId)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data;
}

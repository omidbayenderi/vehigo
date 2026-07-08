"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { scoreMatch } from "@/lib/services/matching";
import { setLeadStatus } from "@/lib/services/leads";
import { logAudit } from "@/lib/services/audit";

export async function selectVehicleForLeadAction(leadId: string, vehicleId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: lead, error: leadError } = await supabase
    .from("leads")
    .select("*")
    .eq("id", leadId)
    .single();
  if (leadError) throw new Error(leadError.message);

  const { data: vehicle, error: vehicleError } = await supabase
    .from("vehicles")
    .select("*")
    .eq("id", vehicleId)
    .single();
  if (vehicleError) throw new Error(vehicleError.message);

  const { score, reasoning } = scoreMatch(lead, vehicle);

  const { error: upsertError } = await supabase
    .from("matches")
    .upsert(
      { lead_id: leadId, vehicle_id: vehicleId, match_score: score, match_reasoning: reasoning },
      { onConflict: "lead_id,vehicle_id" },
    );
  if (upsertError) throw new Error(upsertError.message);

  await setLeadStatus(supabase, leadId, "vehicle_proposed", user.id);
  await logAudit(supabase, user.id, "match_selected", "lead", leadId, { vehicleId, score });

  revalidatePath(`/leads/${leadId}`);
  redirect(`/offers/new?lead_id=${leadId}&vehicle_id=${vehicleId}`);
}

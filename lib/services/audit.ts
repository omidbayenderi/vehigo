import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/lib/supabase/types";

type Client = SupabaseClient<Database>;

export async function logAudit(
  supabase: Client,
  actorId: string,
  action: string,
  entityType: string,
  entityId: string | null,
  metadata?: Json,
) {
  await supabase.from("audit_log").insert({
    actor_id: actorId,
    action,
    entity_type: entityType,
    entity_id: entityId,
    metadata: metadata ?? null,
  });
}

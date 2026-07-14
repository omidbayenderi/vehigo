import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/lib/supabase/types";
import { primaryOrganizationId } from "@/lib/operations/runtime";

type Client = SupabaseClient<Database>;

export async function logAudit(
  supabase: Client,
  actorId: string,
  action: string,
  entityType: string,
  entityId: string | null,
  metadata?: Json,
  organizationId?: string,
) {
  const scopedOrganizationId = organizationId ?? await primaryOrganizationId(supabase, actorId);
  const { error } = await supabase.from("audit_log").insert({
    organization_id: scopedOrganizationId,
    actor_id: actorId,
    action,
    entity_type: entityType,
    entity_id: entityId,
    metadata: metadata ?? null,
  });
  if (error) throw new Error(`Audit log yazılamadı: ${error.message}`);
}

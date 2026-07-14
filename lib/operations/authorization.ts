import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { OperationRuntimeError } from "@/lib/operations/runtime";

type Client = SupabaseClient<Database>;

export async function requireOrganizationOwner(supabase: Client, userId: string, requestedOrganizationId?: string | null) {
  let query = supabase
    .from("organization_members")
    .select("organization_id,role,status")
    .eq("user_id", userId)
    .eq("role", "owner")
    .eq("status", "active");
  if (requestedOrganizationId) query = query.eq("organization_id", requestedOrganizationId);
  const { data, error } = await query.order("joined_at", { ascending: true }).limit(2);
  if (error) throw new OperationRuntimeError("organization_lookup_failed", "Organizasyon yetkisi doğrulanamadı.");
  if (!data.length) throw new OperationRuntimeError("organization_owner_required", "Aktif organizasyon owner yetkisi gerekli.");
  if (!requestedOrganizationId && data.length > 1) throw new OperationRuntimeError("organization_header_required", "Birden fazla organizasyon için x-organization-id başlığı gerekli.");
  return data[0].organization_id;
}

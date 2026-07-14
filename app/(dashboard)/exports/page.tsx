import { createClient } from "@/lib/supabase/server";
import { listExportScenarios } from "@/lib/services/export-scenarios";
import { PageHeader } from "@/components/ui/page-header";
import ExportWorkspace from "./export-workspace";

export default async function ExportsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const [scenarios, { data: ruleSets }, { data: vehicles }, { data: offers }, { data: profile }, { data: rates }] = await Promise.all([
    listExportScenarios(supabase),
    supabase.from("export_rule_sets").select("*").eq("status", "active").order("version", { ascending: false }),
    supabase.from("vehicles").select("id,brand,model,year,price,currency,seller_country,vehicle_type").order("updated_at", { ascending: false }).limit(200),
    supabase.from("offers").select("id,vehicle_id,base_vehicle_price,currency,created_at").order("created_at", { ascending: false }).limit(100),
    supabase.from("users_profile").select("role").eq("id", user.id).single(),
    supabase.from("exchange_rate_snapshots").select("*").order("observed_at", { ascending: false }).limit(20),
  ]);

  return (
    <div>
      <PageHeader
        eyebrow="İhracat motoru"
        title="Landed cost senaryoları"
        description="Çıkış, hedef, rota, araç kategorisi, alıcı profili, kural sürümü ve kur snapshot’ını sabitleyerek yeniden üretilebilir ihracat maliyetleri oluşturun."
      />
      <ExportWorkspace scenarios={scenarios} ruleSets={ruleSets ?? []} vehicles={vehicles ?? []} offers={offers ?? []} rates={rates ?? []} isOwner={profile?.role === "owner"} />
    </div>
  );
}

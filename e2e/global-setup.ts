import { createClient } from "@supabase/supabase-js";

/**
 * İzole test Supabase projesini her koşu öncesi temizler. E2E testleri prod'a
 * karşı ASLA çalıştırılmamalı — bu yüzden env değişkenleri E2E_ önekiyle,
 * .env.local'daki üretim değişkenlerinden bilerek ayrı tutuluyor.
 */
export default async function globalSetup() {
  const url = process.env.E2E_SUPABASE_URL;
  const serviceRoleKey = process.env.E2E_SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    throw new Error(
      "E2E_SUPABASE_URL ve E2E_SUPABASE_SERVICE_ROLE_KEY .env.test.local içinde tanımlı olmalı (bkz. .env.test.local.example)",
    );
  }

  const admin = createClient(url, serviceRoleKey);
  const ZERO_UUID = "00000000-0000-0000-0000-000000000000";

  // offers.lead_id/vehicle_id intentionally don't cascade (a vehicle/lead shouldn't
  // silently take a real offer down with it) — so offers must go first, or the
  // leads/vehicles deletes below fail on the FK and leave stale rows behind.
  for (const table of ["offers", "leads", "vehicles"] as const) {
    const { error } = await admin.from(table).delete().neq("id", ZERO_UUID);
    if (error) throw new Error(`global-setup: "${table}" temizlenemedi: ${error.message}`);
  }
}

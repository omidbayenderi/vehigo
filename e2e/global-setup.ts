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
  await admin.from("leads").delete().neq("id", ZERO_UUID);
  await admin.from("vehicles").delete().neq("id", ZERO_UUID);
}

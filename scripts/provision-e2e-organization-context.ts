import { createClient } from "@supabase/supabase-js";
import path from "node:path";
import process from "node:process";

try { process.loadEnvFile(path.join(process.cwd(), ".env.test.local")); }
catch { throw new Error(".env.test.local is required."); }

const url = process.env.E2E_SUPABASE_URL;
const serviceRoleKey = process.env.E2E_SUPABASE_SERVICE_ROLE_KEY;
const configuredEmail = process.env.E2E_TEST_EMAIL;
if (!url || !serviceRoleKey || !configuredEmail) throw new Error("E2E project and test-user variables are required.");

const apply = process.argv.includes("--apply");
const admin = createClient(url, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });

async function main() {
  const user = await findUser(configuredEmail!);
  const { data: profile, error: profileError } = await admin.from("users_profile").select("id").eq("id", user.id).maybeSingle();
  if (profileError || !profile) throw new Error("Configured E2E user has no users_profile row.");

  const { data: existingOrganization, error: organizationError } = await admin
    .from("organizations")
    .select("id,created_by")
    .eq("slug", "vehigo-default")
    .maybeSingle();
  if (organizationError) throw new Error(`vehigo-default organization could not be checked in the E2E project (${safeError(organizationError)}).`);

  let organization = existingOrganization;
  if (!organization && apply) {
    const { data, error } = await admin.from("organizations").insert({
      slug: "vehigo-default",
      name: "Vehigo E2E",
      status: "active",
      default_currency: "EUR",
      created_by: user.id,
    }).select("id,created_by").single();
    if (error) throw new Error("vehigo-default organization could not be provisioned in E2E.");
    organization = data;
    console.log("✓ Missing vehigo-default organization was provisioned in the disposable E2E project.");
  }

  const membershipResult = organization ? await admin.from("organization_members").select("role,status")
    .eq("organization_id", organization.id).eq("user_id", user.id).maybeSingle() : { data: null, error: null };
  const membership = membershipResult.data;
  if (membershipResult.error) throw new Error("E2E organization membership could not be checked.");

  const { count: strandedVehicles, error: vehicleError } = await admin
    .from("vehicles")
    .select("id", { count: "exact", head: true })
    .eq("created_by", user.id)
    .like("brand", "E2EBrand%");
  if (vehicleError) throw new Error("E2E vehicle residue could not be checked.");

  if (!apply) {
    console.log(`E2E context: organization=${organization ? "present" : "missing"}, membership=${membership ? `${membership.role}/${membership.status}` : "missing"}, stranded_test_vehicles=${strandedVehicles ?? 0}. No identifiers or row data were printed.`);
    process.exitCode = organization && membership?.status === "active" ? 0 : 1;
    return;
  }

  if (!organization) throw new Error("E2E organization provisioning failed.");

  if (!membership) {
    const { error } = await admin.from("organization_members").insert({
      organization_id: organization.id,
      user_id: user.id,
      role: "broker",
      status: "active",
      invited_by: organization.created_by,
      joined_at: new Date().toISOString(),
    });
    if (error) throw new Error("E2E broker membership could not be provisioned.");
    console.log("✓ E2E test user received an active broker membership in vehigo-default.");
  } else if (membership.status !== "active") {
    const { error } = await admin.from("organization_members").update({ status: "active", joined_at: new Date().toISOString() })
      .eq("organization_id", organization.id).eq("user_id", user.id);
    if (error) throw new Error("E2E membership could not be activated.");
    console.log("✓ Existing E2E organization membership was activated without changing its role.");
  } else {
    console.log("✓ E2E organization membership is already active; no change was made.");
  }
}

async function findUser(targetEmail: string) {
  for (let page = 1; page <= 10; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 100 });
    if (error) throw new Error("E2E auth users could not be read.");
    const user = data.users.find((candidate) => candidate.email?.toLowerCase() === targetEmail.toLowerCase());
    if (user) return user;
    if (data.users.length < 100) break;
  }
  throw new Error("Configured E2E test user does not exist.");
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "E2E organization context failed.");
  process.exitCode = 1;
});

function safeError(error: { code?: string; message?: string }) {
  const message = (error.message ?? "")
    .replace(/https?:\/\/\S+/gi, "<redacted-url>")
    .replace(/[A-Za-z0-9_-]{32,}/g, "<redacted-token>")
    .slice(0, 240);
  return `${error.code ?? "unknown"}: ${message}`;
}

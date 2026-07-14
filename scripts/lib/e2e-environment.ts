import path from "node:path";
import process from "node:process";

export function applyE2eEnvironment() {
  try { process.loadEnvFile(path.join(process.cwd(), ".env.test.local")); }
  catch { throw new Error(".env.test.local is required for --e2e acceptance."); }

  if (process.env.E2E_ALLOW_DESTRUCTIVE_CLEANUP !== "true") {
    throw new Error("E2E_ALLOW_DESTRUCTIVE_CLEANUP=true is required for --e2e acceptance.");
  }
  const url = process.env.E2E_SUPABASE_URL;
  const anonKey = process.env.E2E_SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.E2E_SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !anonKey || !serviceRoleKey) throw new Error("Complete E2E Supabase credentials are required.");

  process.env.NEXT_PUBLIC_SUPABASE_URL = url;
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = anonKey;
  process.env.SUPABASE_SERVICE_ROLE_KEY = serviceRoleKey;
}

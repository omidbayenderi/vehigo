import { createClient } from "@supabase/supabase-js";
import path from "node:path";
import process from "node:process";

try {
  process.loadEnvFile(path.join(process.cwd(), ".env.test.local"));
} catch {
  console.error(".env.test.local is required.");
  process.exit(1);
}

const url = process.env.E2E_SUPABASE_URL;
const serviceRoleKey = process.env.E2E_SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceRoleKey) throw new Error("E2E_SUPABASE_URL and E2E_SUPABASE_SERVICE_ROLE_KEY are required.");

const supabase = createClient(url, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
const capabilities: Array<{ migration: string; table: string; columns: string; required?: boolean }> = [
  { migration: "0015a", table: "market_sources", columns: "connector_version" },
  { migration: "0015b", table: "market_sources", columns: "connector_capabilities" },
  { migration: "0016", table: "scanner_ingest_events", columns: "id,status,idempotency_key" },
  { migration: "0017a", table: "watchlists", columns: "country_codes,search_mode,freshness_hours" },
  { migration: "0017b", table: "market_listings", columns: "duplicate_cluster_id" },
  { migration: "0017c", table: "listing_duplicate_clusters", columns: "id,canonical_fingerprint", required: false },
  { migration: "0018", table: "ai_evaluations", columns: "id,status,prompt_version" },
  { migration: "0019", table: "export_scenarios", columns: "id,status,approval_status" },
  { migration: "0021", table: "export_scenario_documents", columns: "id,evidence_reference,evidence_sha256" },
  { migration: "0022", table: "organizations", columns: "id,slug,status" },
  { migration: "0022", table: "operation_jobs", columns: "id,organization_id,status" },
  { migration: "0024", table: "provider_slo_policies", columns: "id,organization_id,provider_key" },
  { migration: "0024", table: "recovery_drills", columns: "id,organization_id,status" },
  { migration: "0026a", table: "vehicles", columns: "id,organization_id" },
  { migration: "0026b", table: "leads", columns: "id,organization_id" },
  { migration: "0026c", table: "offers", columns: "id,organization_id" },
  { migration: "0026d", table: "watchlists", columns: "id,organization_id" },
  { migration: "0026e", table: "listing_purchase_checklist", columns: "id,organization_id" },
  { migration: "0026f", table: "ai_evaluations", columns: "id,organization_id" },
  { migration: "0026g", table: "export_scenarios", columns: "id,organization_id" },
  { migration: "0026h", table: "platform_admins", columns: "user_id,created_at" },
];

async function main() {
  let failed = 0;
  let warnings = 0;
  for (const capability of capabilities) {
    const { error } = await supabase.from(capability.table).select(capability.columns).limit(1);
    if (error) {
      if (capability.required === false) {
        warnings += 1;
        console.warn(`△ ${capability.migration} ${capability.table}: optional direct REST visibility unavailable; dedup FK and E2E flow are verified separately`);
      } else {
        failed += 1;
        console.error(`✗ ${capability.migration} ${capability.table}: ${classify(error.code, error.message)}`);
      }
    } else {
      console.log(`✓ ${capability.migration} ${capability.table}`);
    }
  }

  const requiredCount = capabilities.filter((capability) => capability.required !== false).length;
  console.log(`Schema capability result: ${requiredCount - failed}/${requiredCount} required passed; warnings=${warnings}. No credentials or row data were printed.`);
  process.exitCode = failed ? 1 : 0;
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Schema capability check failed.");
  process.exitCode = 1;
});

function classify(code: string | undefined, message: string) {
  if (code === "42P01" || /does not exist|schema cache/i.test(message)) return "missing table or schema cache entry";
  if (code === "42703" || /column .* does not exist|could not find.*column|connector_(?:version|capabilities)/i.test(message)) return "missing required column";
  return `query failed (${code ?? "unknown"}): ${sanitize(message)}`;
}

function sanitize(value: string) {
  return value
    .replace(/https?:\/\/\S+/gi, "<redacted-url>")
    .replace(/[A-Za-z0-9_-]{32,}/g, "<redacted-token>")
    .replace(/[^\p{L}\p{N}\s.,:_()'"-]/gu, "?")
    .slice(0, 320);
}

import { createAdminClient } from "@/lib/supabase/admin";

async function main() {
  const { data, error } = await createAdminClient().rpc("run_operational_maintenance");
  if (error) throw new Error(error.message);
  console.log(JSON.stringify({ event: "operational.maintenance.completed", result: data }));
}

void main().catch((error: unknown) => {
  console.error(JSON.stringify({ event: "operational.maintenance.failed", error: error instanceof Error ? error.message : "Unknown error" }));
  process.exitCode = 1;
});

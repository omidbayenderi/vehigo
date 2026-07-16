import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync("supabase/migrations/0032_dual_brave_processing_modes.sql", "utf8");
const manualForceMigration = readFileSync("supabase/migrations/0033_force_manual_site_agent_scan.sql", "utf8");

describe("dual Brave processing mode migration", () => {
  it("defines transient and persistent modes explicitly", () => {
    expect(migration).toContain("processing_mode in ('transient_search', 'persistent_search')");
    expect(migration).toContain("activate_transient_site_search_agent_fleet");
    expect(migration).toContain("processing_mode = 'transient_search'");
    expect(migration).toContain("processing_mode = 'persistent_search'");
  });

  it("keeps contractual evidence mandatory only for persistent claims", () => {
    expect(migration).toContain("agent.processing_mode = 'persistent_search'");
    expect(migration).toContain("agent.processing_mode = 'transient_search' or storage_rights_verified");
    expect(migration).toContain("Active Brave storage-rights evidence is required.");
  });

  it("allows only explicit manual runs to bypass the schedule timestamp", () => {
    expect(manualForceMigration).toContain("p_force boolean default false");
    expect(manualForceMigration).toContain("and (p_force or agent.next_run_at <= now())");
    expect(manualForceMigration).toContain("grant execute on function public.claim_due_site_search_agents(text, int, int, text, boolean) to service_role");
  });
});

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL("../supabase/migrations/20260718190635_consolidate_europe_web_scout.sql", import.meta.url),
  "utf8",
);

describe("unified Europe Web Scout migration", () => {
  it("retires per-domain agents and leaves one hard-budgeted transient scout", () => {
    expect(migration).toMatch(/where source_key <> 'brave_web'/i);
    expect(migration).toMatch(/set status = 'retired'/i);
    expect(migration).toMatch(/'brave_web'[\s\S]*'europe\.marketplaces'/i);
    expect(migration).toMatch(/'transient_search'[\s\S]*'pending_activation'[\s\S]*480[\s\S]*0[\s\S]*4[\s\S]*1[\s\S]*12/i);
  });

  it("keeps reconciliation single-agent and service-role-only", () => {
    expect(migration).toMatch(/create or replace function public\.reconcile_site_search_agent_fleet/i);
    expect(migration).toMatch(/security invoker/i);
    expect(migration).toMatch(/revoke all on function public\.reconcile_site_search_agent_fleet\(\) from public, anon, authenticated/i);
    expect(migration).toMatch(/grant execute on function public\.reconcile_site_search_agent_fleet\(\) to service_role/i);
  });
});

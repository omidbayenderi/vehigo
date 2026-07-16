import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL("../supabase/migrations/0031_reconcile_source_agents_with_chef.sql", import.meta.url),
  "utf8",
);

describe("source-agent reconciliation and Chef ownership", () => {
  it("creates one agent per catalog target while keeping Brave as the shared provider", () => {
    expect(migration).toMatch(/drop constraint if exists site_search_agents_host_key/i);
    expect(migration).toMatch(/function public\.reconcile_site_search_agent_fleet/i);
    expect(migration).toMatch(/source\.key <> 'brave_web'/i);
    expect(migration).not.toMatch(/partition by normalized_host/i);
    expect(migration).toMatch(/on conflict \(source_key\) do update/i);
  });

  it("keeps reconciliation restricted to the Chef service role", () => {
    expect(migration).toMatch(/Service role required/i);
    expect(migration).toMatch(/revoke all[\s\S]*public, anon, authenticated/i);
    expect(migration).toMatch(/grant execute[\s\S]*service_role/i);
  });
});

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL("../supabase/migrations/20260718203537_increase_europe_web_scout_frequency.sql", import.meta.url),
  "utf8",
);

describe("Europe Web Scout nine-run frequency migration", () => {
  it("sets a 160-minute interval and a hard 36-request daily budget", () => {
    expect(migration).toMatch(/where source_key = 'brave_web'/i);
    expect(migration).toMatch(/interval_minutes = 160/i);
    expect(migration).toMatch(/max_queries_per_run = 4/i);
    expect(migration).toMatch(/max_pages_per_query = 1/i);
    expect(migration).toMatch(/daily_query_limit = 36/i);
  });

  it("keeps reconciliation from restoring the old three-run budget", () => {
    expect(migration).toMatch(/create or replace function public\.reconcile_site_search_agent_fleet/i);
    expect(migration).toMatch(/'transient_search', 'pending_activation', 160, 0, 4, 1, 36/i);
    expect(migration).toMatch(/grant execute on function public\.reconcile_site_search_agent_fleet\(\) to service_role/i);
  });
});

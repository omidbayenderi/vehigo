import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL("../supabase/migrations/20260718220010_federated_search_router_cache.sql", import.meta.url),
  "utf8",
);

describe("federated search router cache migration", () => {
  it("stores only a query fingerprint in the usage receipt", () => {
    expect(migration).toContain("federated_search_query_receipts");
    expect(migration).toContain("query_hash text not null");
    expect(migration).not.toMatch(/query_text\s+text/i);
  });

  it("caps provider result cache retention at 24 hours and keeps it private", () => {
    expect(migration).toMatch(/expires_at <= created_at \+ interval '24 hours'/i);
    expect(migration).toMatch(/enable row level security/i);
    expect(migration).toMatch(/revoke all on public\.federated_search_result_cache from anon, authenticated/i);
    expect(migration).toMatch(
      /grant select, insert, update, delete on public\.federated_search_result_cache to service_role/i,
    );
    expect(migration).toMatch(
      /grant select, insert, update on public\.federated_search_query_receipts to service_role/i,
    );
  });

  it("keeps receipt aggregation atomic without a security-definer function", () => {
    expect(migration).toMatch(/on conflict \(query_hash, search_day\) do update/i);
    expect(migration).toMatch(/security invoker/i);
    expect(migration).not.toMatch(/security definer/i);
  });

  it("reserves one primary and one fallback request for each query variant", () => {
    expect(migration).toMatch(/max_queries_per_run = 4/i);
    expect(migration).toMatch(/max_pages_per_query = 2/i);
    expect(migration).toMatch(/daily_query_limit = 72/i);
    expect(migration).toMatch(/160, 0, 4, 2, 72/i);
  });
});

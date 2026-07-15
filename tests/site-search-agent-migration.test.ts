import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL("../supabase/migrations/0027_site_search_agent_fleet.sql", import.meta.url),
  "utf8",
);
const workflow = readFileSync(
  new URL("../.github/workflows/scanner-cron.yml", import.meta.url),
  "utf8",
);

describe("0027 site-agent migration contract", () => {
  it("deduplicates normalized hosts and seeds the replacement fleet paused", () => {
    expect(migration).toMatch(/partition by normalized_host/i);
    expect(migration).toMatch(/row_number\(\)[\s\S]*host_rank/i);
    expect(migration).toMatch(/then 'blocked' else 'pending_activation'/i);
  });

  it("reconciles an incomplete older 0027 schema before reseeding", () => {
    expect(migration).toMatch(/add column if not exists daily_request_count/i);
    expect(migration).toMatch(/drop constraint if exists site_search_agents_status_check/i);
    expect(migration).toMatch(/add constraint site_search_agents_status_check[\s\S]*pending_activation/i);
    expect(migration).toMatch(/add column if not exists worker_id/i);
    expect(migration).toMatch(/migration_recovery/i);
  });

  it("keeps activation separate from schema installation", () => {
    expect(migration).toMatch(/function public\.activate_site_search_agent_fleet/i);
    expect(migration).toMatch(/where status = 'pending_activation'/i);
    expect(migration).toMatch(/where key = 'brave_web'/i);
    expect(migration).toMatch(/provider_storage_rights_evidence/i);
    expect(migration).toMatch(/Active Brave storage-rights evidence is required/i);
    expect(migration).toMatch(/Active Brave storage-rights evidence is missing, expired, or revoked/i);
  });

  it("atomically leases and fences twice-daily digest alerts", () => {
    expect(migration).toMatch(/digest_claim_token uuid/i);
    expect(migration).toMatch(/function public\.claim_opportunity_digest_alerts/i);
    expect(migration).toMatch(/for update skip locked/i);
    expect(migration).toMatch(/function public\.finish_opportunity_digest_alerts/i);
    expect(migration).toMatch(/alert\.digest_claim_token = p_claim_token/i);
    expect(migration).toMatch(/function public\.mark_opportunity_digest_uncertain/i);
    expect(migration).toMatch(/delivery_uncertain:/i);
  });

  it("fences and atomically finishes every leased run", () => {
    expect(migration).toMatch(/lease_token uuid/i);
    expect(migration).toMatch(/function public\.start_site_search_agent_run/i);
    expect(migration).toMatch(/function public\.finish_site_search_agent_run/i);
    expect(migration).toMatch(/Stale or invalid site-agent completion/i);
    expect(migration).toMatch(/error_code = 'lease_expired'/i);
  });

  it("reserves a hard request budget and releases only unused capacity", () => {
    expect(migration).toMatch(/daily_request_count/i);
    expect(migration).toMatch(/reserved_request_count/i);
    expect(migration).toMatch(/unused_reservation := run\.reserved_request_count - p_request_count/i);
    expect(migration).toMatch(/daily_request_count - unused_reservation/i);
  });

  it("keeps scheduled claim capacity above the seeded fleet demand", () => {
    expect(migration).toMatch(/greatest\(480, source\.min_interval_minutes\)/i);
    expect(workflow).toContain('cron: "*/10 * * * *"');
    const conservativeAgents = 40;
    const dueRunsPerAgentPerDay = 3;
    const schedulerClaimsPerDay = 24 * 6;
    expect(conservativeAgents * dueRunsPerAgentPerDay).toBeLessThanOrEqual(schedulerClaimsPerDay);
  });
});

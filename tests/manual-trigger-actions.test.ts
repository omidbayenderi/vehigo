import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createAdminClient: vi.fn(),
  createClient: vi.fn(),
  logAudit: vi.fn(),
  revalidatePath: vi.fn(),
  runScannerOnce: vi.fn(),
  sendOpportunityDigest: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: mocks.createAdminClient }));
vi.mock("@/lib/services/audit", () => ({ logAudit: mocks.logAudit }));
vi.mock("@/lib/scanner/runner", () => ({ runScannerOnce: mocks.runScannerOnce }));
vi.mock("@/lib/services/opportunity-digest", () => ({ sendOpportunityDigest: mocks.sendOpportunityDigest }));

import { runScannerNowAction, sendDigestNowAction } from "@/app/(dashboard)/alerts/actions";

function ownerClient() {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: "00000000-0000-4000-8000-000000000001" } } }),
    },
    rpc: vi.fn().mockResolvedValue({ data: true, error: null }),
  };
}

describe("manual alert operations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createClient.mockResolvedValue(ownerClient());
    mocks.createAdminClient.mockReturnValue({ kind: "admin" });
    mocks.logAudit.mockResolvedValue(undefined);
  });

  it("records a manual scanner run without putting a command string in the UUID entity field", async () => {
    mocks.runScannerOnce.mockResolvedValue({
      scannedSources: 1,
      fetched: 4,
      inserted: 2,
      alertsCreated: 1,
      delisted: 0,
      failed: [],
    });

    const result = await runScannerNowAction();

    expect(result.error).toBeUndefined();
    expect(mocks.logAudit).toHaveBeenCalledWith(
      expect.anything(),
      "00000000-0000-4000-8000-000000000001",
      "manual_run",
      "scanner",
      null,
      { command: "run" },
    );
  });

  it("does not let an organization owner trigger the platform-wide scanner", async () => {
    const client = ownerClient();
    client.rpc.mockResolvedValue({ data: false, error: null });
    mocks.createClient.mockResolvedValue(client);

    const result = await runScannerNowAction();

    expect(result.error).toContain("platform yöneticisi");
    expect(mocks.createAdminClient).not.toHaveBeenCalled();
    expect(mocks.runScannerOnce).not.toHaveBeenCalled();
  });

  it("records a manual digest send without putting a command string in the UUID entity field", async () => {
    mocks.sendOpportunityDigest.mockResolvedValue({
      users: 0,
      sent: 0,
      skipped: 0,
      failed: 0,
      healthIssues: 0,
    });

    const result = await sendDigestNowAction();

    expect(result.error).toBeUndefined();
    expect(mocks.logAudit).toHaveBeenCalledWith(
      expect.anything(),
      "00000000-0000-4000-8000-000000000001",
      "manual_run",
      "digest",
      null,
      { command: "send" },
    );
  });
});

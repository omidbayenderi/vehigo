import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  checkScannerHealth: vi.fn(),
  sendTelegramMessage: vi.fn(),
}));

vi.mock("@/lib/services/scanner-health", () => ({
  checkScannerHealth: mocks.checkScannerHealth,
}));
vi.mock("@/lib/services/notifications", () => ({
  sendTelegramMessage: mocks.sendTelegramMessage,
}));

import { sendOpportunityDigest } from "@/lib/services/opportunity-digest";

function query(result: { data: unknown; error: null }) {
  const chain: Record<string, unknown> = {};
  for (const method of ["select", "eq", "is", "not", "order", "limit", "in"]) {
    chain[method] = vi.fn(() => chain);
  }
  chain.then = (resolve: (value: unknown) => unknown) => Promise.resolve(result).then(resolve);
  return chain;
}

describe("Telegram scanner health delivery", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.checkScannerHealth.mockResolvedValue([{
      sourceKey: "brave_web",
      sourceName: "Brave Web Search",
      kind: "failing",
      detail: "Saklama hakkı doğrulanmadı",
    }]);
    mocks.sendTelegramMessage.mockResolvedValue({ ok: true });
  });

  it("notifies linked users even when there are no listing candidates", async () => {
    const pendingAlerts = query({ data: [], error: null });
    const linkedProfiles = query({
      data: [{
        id: "00000000-0000-4000-8000-000000000001",
        telegram_chat_id: "12345",
        telegram_verified_at: "2026-07-16T00:00:00.000Z",
      }],
      error: null,
    });
    const rpc = vi.fn(async (name: string) => {
      if (name === "claim_opportunity_digest_alerts") return { data: [], error: null };
      throw new Error(`Unexpected RPC: ${name}`);
    });
    const from = vi.fn((table: string) => {
      if (table === "listing_alerts") return pendingAlerts;
      if (table === "users_profile") return linkedProfiles;
      throw new Error(`Unexpected table: ${table}`);
    });

    const result = await sendOpportunityDigest({ from, rpc } as never);

    expect(mocks.sendTelegramMessage).toHaveBeenCalledWith(
      "12345",
      expect.stringContaining("هشدار سلامت جست‌وجوگر"),
    );
    expect(result).toMatchObject({ users: 1, sent: 1, failed: 0, pendingAlerts: 0, healthIssues: 1 });
  });
});

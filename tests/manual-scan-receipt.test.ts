import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ sendTelegramMessage: vi.fn() }));
vi.mock("@/lib/services/notifications", () => ({ sendTelegramMessage: mocks.sendTelegramMessage }));

import { sendManualScanReceipt } from "@/lib/services/manual-scan-receipt";

function client(profile: { telegram_chat_id: string | null; telegram_verified_at: string | null }) {
  const query = {
    select: vi.fn(),
    eq: vi.fn(),
    maybeSingle: vi.fn().mockResolvedValue({ data: profile, error: null }),
  };
  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  return { from: vi.fn(() => query) };
}

const summary = {
  fetched: 40,
  alertsCreated: 0,
  alertsSent: 0,
  alertsFailed: 0,
  siteAgents: { completed: 1 },
} as never;

describe("manual scan Telegram receipt", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.sendTelegramMessage.mockResolvedValue({ ok: true });
  });

  it("sends a completion receipt even when the scan has no matches", async () => {
    const result = await sendManualScanReceipt(client({
      telegram_chat_id: "12345",
      telegram_verified_at: "2026-07-16T00:00:00.000Z",
    }) as never, "user-1", summary);

    expect(result).toEqual({ sent: true });
    expect(mocks.sendTelegramMessage).toHaveBeenCalledWith("12345", expect.stringContaining("Filtrelerinize uyan yeni ilan bulunmadı"));
  });

  it("reports an unlinked profile without calling Telegram", async () => {
    const result = await sendManualScanReceipt(client({ telegram_chat_id: null, telegram_verified_at: null }) as never, "user-1", summary);
    expect(result).toEqual({ sent: false, reason: "not_linked" });
    expect(mocks.sendTelegramMessage).not.toHaveBeenCalled();
  });
});

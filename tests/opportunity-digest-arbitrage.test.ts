import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  checkScannerHealth: vi.fn(),
  sendTelegramMessage: vi.fn(),
  assessEuropeanArbitrage: vi.fn(),
}));

vi.mock("@/lib/services/scanner-health", () => ({
  checkScannerHealth: mocks.checkScannerHealth,
}));
vi.mock("@/lib/services/notifications", () => ({
  sendTelegramMessage: mocks.sendTelegramMessage,
}));
vi.mock("@/lib/services/arbitrage-agent", () => ({
  assessEuropeanArbitrage: mocks.assessEuropeanArbitrage,
}));

import { sendOpportunityDigest } from "@/lib/services/opportunity-digest";

function query(result: { data: unknown; error: null }) {
  const methods = ["select", "eq", "is", "not", "order", "limit", "in"] as const;
  const chain = {} as Record<(typeof methods)[number], ReturnType<typeof vi.fn>> & {
    then: (resolve: (value: unknown) => unknown) => Promise<unknown>;
  };
  for (const method of methods) {
    chain[method] = vi.fn(() => chain);
  }
  chain.then = (resolve: (value: unknown) => unknown) => Promise.resolve(result).then(resolve);
  return chain;
}

const listing = {
  id: "listing-1",
  brand: "MAN",
  model: "TGX",
  year: 2019,
  price: 22000,
  currency: "EUR",
  title: "MAN TGX 18.440 Sattelzugmaschine",
  seller_city: null,
  seller_country: null,
  source_key: "apify_mobile_de",
  listing_url: "https://mobile.de/example-1",
  raw: {},
};

const alertRow = {
  id: "alert-1",
  user_id: "00000000-0000-4000-8000-000000000001",
  status: "pending",
  sent_at: null,
  alert_type: "new_match",
  opportunity_score: 90,
  opportunity_label: "hot",
  opportunity_reasons: [],
  market_listings: listing,
  watchlists: { name: "Çekici Almanya" },
  users_profile: { telegram_chat_id: "12345", locale: "tr" },
};

describe("opportunity digest arbitrage highlight", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.checkScannerHealth.mockResolvedValue([]);
    mocks.sendTelegramMessage.mockResolvedValue({ ok: true });
  });

  it("calls the arbitrage engine for each claimed alert and highlights approved ones", async () => {
    mocks.assessEuropeanArbitrage.mockResolvedValue({
      approved: true, confidence: 0.8, comparableCount: 9, medianComparablePrice: 39000,
      estimatedNetProfitPercent: 57.3, reason: "Fiyat medyanın belirgin altında", aiUsed: true,
    });
    const pendingAlerts = query({ data: [alertRow], error: null });
    const claimedAlerts = query({ data: [alertRow], error: null });
    const from = vi.fn((table: string) => {
      if (table === "listing_alerts") return pendingAlerts.select.mock.calls.length === 0 ? pendingAlerts : claimedAlerts;
      throw new Error(`Unexpected table: ${table}`);
    });
    const rpc = vi.fn(async (name: string) => {
      if (name === "claim_opportunity_digest_alerts") return { data: [{ id: "alert-1" }], error: null };
      if (name === "finish_opportunity_digest_alerts") return { data: 1, error: null };
      throw new Error(`Unexpected RPC: ${name}`);
    });

    await sendOpportunityDigest({ from, rpc } as never);

    expect(mocks.assessEuropeanArbitrage).toHaveBeenCalledWith(expect.anything(), listing, alertRow.watchlists);
    expect(mocks.sendTelegramMessage).toHaveBeenCalledWith("12345", expect.stringContaining("Gerçek Arbitraj Fırsatı"));
  });

  it("delivers the ordinary digest even when the arbitrage check throws", async () => {
    mocks.assessEuropeanArbitrage.mockRejectedValue(new Error("piyasa istihbaratı başarısız"));
    const pendingAlerts = query({ data: [alertRow], error: null });
    const claimedAlerts = query({ data: [alertRow], error: null });
    const from = vi.fn((table: string) => {
      if (table === "listing_alerts") return pendingAlerts.select.mock.calls.length === 0 ? pendingAlerts : claimedAlerts;
      throw new Error(`Unexpected table: ${table}`);
    });
    const rpc = vi.fn(async (name: string) => {
      if (name === "claim_opportunity_digest_alerts") return { data: [{ id: "alert-1" }], error: null };
      if (name === "finish_opportunity_digest_alerts") return { data: 1, error: null };
      throw new Error(`Unexpected RPC: ${name}`);
    });

    const result = await sendOpportunityDigest({ from, rpc } as never);

    expect(result).toMatchObject({ sent: 1, failed: 0 });
    expect(mocks.sendTelegramMessage).toHaveBeenCalledWith("12345", expect.not.stringContaining("Gerçek Arbitraj Fırsatı"));
  });
});

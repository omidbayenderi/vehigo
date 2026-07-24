import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Database } from "@/lib/supabase/types";

const mocks = vi.hoisted(() => ({
  sendTelegramMessage: vi.fn(),
  claimTransientDeliveryReceipts: vi.fn(),
  completeTransientDeliveryReceipts: vi.fn(),
  releaseTransientDeliveryReceipts: vi.fn(),
}));
vi.mock("@/lib/services/notifications", () => ({ sendTelegramMessage: mocks.sendTelegramMessage }));
vi.mock("@/lib/services/transient-delivery-receipts", () => ({
  transientReceiptHash: (candidate: { sourceIdentity: string }) => `hash:${candidate.sourceIdentity}`,
  receiptClaimKey: (candidate: { organizationId: string; userId: string; sourceKey: string }, hash: string) =>
    `${candidate.organizationId}:${candidate.userId}:${candidate.sourceKey}:${hash}`,
  claimTransientDeliveryReceipts: mocks.claimTransientDeliveryReceipts,
  completeTransientDeliveryReceipts: mocks.completeTransientDeliveryReceipts,
  releaseTransientDeliveryReceipts: mocks.releaseTransientDeliveryReceipts,
}));

import { assessTransientCommercialOpportunity, processTransientListings } from "@/lib/services/transient-opportunity";

type Watchlist = Database["public"]["Tables"]["watchlists"]["Row"];
type Listing = Database["public"]["Tables"]["market_listings"]["Row"];

const watchlist = {
  id: "watch-1",
  organization_id: "00000000-0000-4000-8000-000000000001",
  user_id: "user-1",
  name: "Golf Almanya",
  active: true,
  source_keys: ["brave_web"],
  country: "Germany",
  city: null,
  brand: "Volkswagen",
  model: "Golf",
  vehicle_type: "car",
  min_year: 2020,
  max_year: null,
  max_mileage_km: 80_000,
  min_price: null,
  max_price: 22_000,
  currency: "EUR",
  keywords: [],
  target_price: 21_000,
  must_have_keywords: [],
  excluded_keywords: [],
  created_at: "2026-07-16T00:00:00.000Z",
  updated_at: "2026-07-16T00:00:00.000Z",
} satisfies Watchlist;

describe("transient opportunity processing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.TELEGRAM_TRANSIENT_CHANNELS_ENABLED;
    delete process.env.TELEGRAM_TRANSIENT_CHANNEL_SOURCE_ALLOWLIST;
    mocks.sendTelegramMessage.mockResolvedValue({ ok: true });
    mocks.claimTransientDeliveryReceipts.mockImplementation(async (_supabase, candidates) => new Map(candidates.map((candidate: {
      organizationId: string; userId: string; sourceKey: string; sourceIdentity: string;
    }) => {
      const receiptHash = `hash:${candidate.sourceIdentity}`;
      const claimKey = `${candidate.organizationId}:${candidate.userId}:${candidate.sourceKey}:${receiptHash}`;
      return [claimKey, { ...candidate, receiptHash, claimKey }];
    })));
  });

  it("matches and delivers within the same run without writing listings or alerts", async () => {
    const response = Promise.resolve({
      data: [{ id: "user-1", telegram_chat_id: "12345", telegram_verified_at: "2026-07-16T00:00:00.000Z" }],
      error: null,
    });
    const query = {
      select: vi.fn(),
      in: vi.fn(),
      not: vi.fn(),
      then: response.then.bind(response),
    };
    query.select.mockReturnValue(query);
    query.in.mockReturnValue(query);
    query.not.mockReturnValue(query);
    const from = vi.fn((table: string) => {
      expect(table).toBe("users_profile");
      return query;
    });

    const result = await processTransientListings({ from } as never, [{
      source_key: "mobile_de",
      source_listing_id: "mobile-1",
      listing_url: "https://mobile.de/vehicle/1",
      title: "Volkswagen Golf 2022",
      seller_country: "Germany",
      brand: "Volkswagen",
      model: "Golf",
      year: 2022,
      mileage_km: 42_000,
      price: 18_500,
      currency: "EUR",
      vehicle_type: "car",
    }], [watchlist]);

    expect(result).toEqual({
      fetched: 1, inserted: 0, alertsCreated: 1, alertsSent: 1, alertsFailed: 0, rejected: 0, deferred: 0,
    });
    expect(from).toHaveBeenCalledOnce();
    expect(mocks.sendTelegramMessage).toHaveBeenCalledWith("12345", expect.stringContaining("İlan içeriği kaydedilmedi"));
    expect(mocks.completeTransientDeliveryReceipts).toHaveBeenCalledOnce();
  });

  it("sends only an aggregate channel signal when no source has republishing permission", async () => {
    process.env.TELEGRAM_TRANSIENT_CHANNELS_ENABLED = "true";
    const response = Promise.resolve({
      data: [{ id: "user-1", telegram_chat_id: "12345", telegram_verified_at: "2026-07-16T00:00:00.000Z", locale: "tr" }],
      error: null,
    });
    const query = { select: vi.fn(), in: vi.fn(), not: vi.fn(), then: response.then.bind(response) };
    query.select.mockReturnValue(query);
    query.in.mockReturnValue(query);
    query.not.mockReturnValue(query);

    await processTransientListings({ from: vi.fn(() => query) } as never, [{
      source_key: "mobile_de",
      source_listing_id: "mobile-private-signal",
      listing_url: "https://mobile.de/vehicle/private-signal",
      title: "Volkswagen Golf 2022",
      seller_country: "Germany",
      brand: "Volkswagen",
      model: "Golf",
      year: 2022,
      mileage_km: 42_000,
      price: 18_500,
      currency: "EUR",
      vehicle_type: "car",
    }], [watchlist]);

    const channelMessage = mocks.sendTelegramMessage.mock.calls.find(([destination]) => destination === "@Vehigo_Kriter")?.[1];
    expect(channelMessage).toContain("YENİ KRİTER EŞLEŞMESİ");
    expect(channelMessage).toContain("Ayrıntılar yalnızca doğrulanmış özel mesajınıza gönderildi");
    expect(channelMessage).not.toContain("Volkswagen Golf");
    expect(channelMessage).not.toContain("mobile.de");
  });

  it("does not deliver a receipt that was already claimed by an earlier run", async () => {
    mocks.claimTransientDeliveryReceipts.mockResolvedValue(new Map());
    const response = Promise.resolve({
      data: [{ id: "user-1", telegram_chat_id: "12345", telegram_verified_at: "2026-07-16T00:00:00.000Z", locale: "tr" }],
      error: null,
    });
    const query = { select: vi.fn(), in: vi.fn(), not: vi.fn(), then: response.then.bind(response) };
    query.select.mockReturnValue(query);
    query.in.mockReturnValue(query);
    query.not.mockReturnValue(query);

    const result = await processTransientListings({ from: vi.fn(() => query) } as never, [{
      source_key: "mobile_de",
      source_listing_id: "mobile-1",
      listing_url: "https://mobile.de/vehicle/1",
      title: "Volkswagen Golf 2022",
      seller_country: "Germany",
      brand: "Volkswagen",
      model: "Golf",
      year: 2022,
      mileage_km: 42_000,
      price: 18_500,
      currency: "EUR",
      vehicle_type: "car",
    }], [watchlist]);

    expect(result).toMatchObject({ alertsCreated: 0, alertsSent: 0, alertsFailed: 0 });
    expect(mocks.sendTelegramMessage).not.toHaveBeenCalled();
  });

  it("rejects malformed provider data in memory and does not attempt delivery", async () => {
    const from = vi.fn();
    const result = await processTransientListings({ from } as never, [{
      source_key: "mobile_de",
      listing_url: "javascript:alert(1)",
    }], [watchlist]);

    expect(result).toMatchObject({ fetched: 1, inserted: 0, rejected: 1, alertsCreated: 0 });
    expect(from).not.toHaveBeenCalled();
    expect(mocks.sendTelegramMessage).not.toHaveBeenCalled();
  });

  it("calculates cross-source market proof from the same in-memory batch", () => {
    const candidate = {
      source_key: "mobile_de", source_listing_id: "candidate", price: 10_000, currency: "EUR",
      brand: "Volkswagen", model: "Golf", condition: "used_good",
    } as unknown as Listing;
    const comparables = Array.from({ length: 6 }, (_, index) => ({
      source_key: index % 2 === 0 ? "autoscout24" : "mobile_de",
      source_listing_id: `comparable-${index}`,
      price: 19_000 + index * 400,
      currency: "EUR",
      brand: "Volkswagen",
      model: "Golf",
      condition: "used_good",
    })) as unknown as Listing[];

    const assessment = assessTransientCommercialOpportunity(candidate, watchlist, [candidate, ...comparables]);

    expect(assessment).toMatchObject({
      status: "approved",
      approved: true,
      comparableCount: 6,
      sourceCount: 2,
    });
    expect(assessment?.estimatedNetProfit).toBeGreaterThan(3_000);
  });
});

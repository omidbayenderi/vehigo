import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Database } from "@/lib/supabase/types";

const mocks = vi.hoisted(() => ({ sendTelegramMessage: vi.fn() }));
vi.mock("@/lib/services/notifications", () => ({ sendTelegramMessage: mocks.sendTelegramMessage }));

import { processTransientListings } from "@/lib/services/transient-opportunity";

type Watchlist = Database["public"]["Tables"]["watchlists"]["Row"];

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
    mocks.sendTelegramMessage.mockResolvedValue({ ok: true });
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
    expect(mocks.sendTelegramMessage).toHaveBeenCalledWith("12345", expect.stringContaining("kaydedilmeden işlendi"));
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
});

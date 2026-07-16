import { describe, expect, it } from "vitest";
import { formatDigest, isUnsentDigestAlert } from "@/lib/services/opportunity-digest";

describe("Telegram opportunity digest localization", () => {
  it("only treats pending alerts that have never been sent as digest candidates", () => {
    expect(isUnsentDigestAlert({ status: "pending", sent_at: null })).toBe(true);
    expect(isUnsentDigestAlert({ status: "sent", sent_at: "2026-07-14T08:00:00.000Z" })).toBe(false);
    expect(isUnsentDigestAlert({ status: "pending", sent_at: "2026-07-14T08:00:00.000Z" })).toBe(false);
  });

  it("formats the complete opportunity message in fluent Persian", () => {
    const alert = {
      alert_type: "new_match",
      opportunity_label: "good",
      opportunity_score: 78,
      opportunity_reasons: ["Marka uyumu: Toyota"],
      market_listings: {
        title: "Toyota Corolla Touring Sports",
        brand: "Toyota",
        model: "Corolla",
        year: 2022,
        price: 18900,
        currency: "EUR",
        seller_city: "Berlin",
        seller_country: "Germany",
        source_key: "brave_web",
        listing_url: "https://www.mobile.de/example",
        raw: { vehigo_seat_count: 5, vehigo_condition: "used_good" },
      },
      watchlists: { name: "Corolla Avrupa" },
    };

    const message = formatDigest([alert] as never, 12, "fa");

    expect(message).toContain("خلاصه فرصت‌های وهیگو");
    expect(message).toContain("تعداد صندلی: ۵");
    expect(message).toContain("وضعیت: دست‌دوم ـ خوب");
    expect(message).toContain("منبع: mobile.de");
    expect(message).toContain("دلیل: تطابق برند: Toyota");
    expect(message).toContain("مشاهده آگهی");
  });

  it("prepends an arbitrage highlight only for alerts the arbitrage engine approved", () => {
    const approvedAlert = {
      id: "alert-1",
      alert_type: "new_match",
      opportunity_label: "hot",
      opportunity_score: 90,
      opportunity_reasons: [],
      market_listings: {
        title: "MAN TGX 18.440 Sattelzugmaschine", brand: "MAN", model: "TGX", year: 2019,
        price: 22000, currency: "EUR", seller_city: null, seller_country: null,
        source_key: "apify_mobile_de", listing_url: "https://mobile.de/example-1", raw: {},
      },
      watchlists: { name: "Çekici Almanya" },
    };
    const ordinaryAlert = {
      id: "alert-2",
      alert_type: "new_match",
      opportunity_label: "good",
      opportunity_score: 70,
      opportunity_reasons: [],
      market_listings: {
        title: "MAN TGX 18.440", brand: "MAN", model: "TGX", year: 2018,
        price: 38000, currency: "EUR", seller_city: null, seller_country: null,
        source_key: "apify_mobile_de", listing_url: "https://mobile.de/example-2", raw: {},
      },
      watchlists: { name: "Çekici Almanya" },
    };
    const arbitrageByAlertId = new Map([[
      "alert-1",
      {
        approved: true, confidence: 0.82, comparableCount: 9, medianComparablePrice: 39000,
        estimatedNetProfitPercent: 57.3, reason: "Fiyat medyanın belirgin altında ve risk sinyali yok", aiUsed: true,
      },
    ]]);

    const message = formatDigest([approvedAlert, ordinaryAlert] as never, 12, "tr", arbitrageByAlertId as never);

    expect(message).toContain("🔥 <b>Gerçek Arbitraj Fırsatı</b>");
    expect(message).toContain("Tahmini net kâr: %57.3");
    expect(message).toContain("Medyan karşılaştırma: 39.000 EUR (9 ilan)");
    expect(message.indexOf("🔥")).toBeLessThan(message.indexOf("MAN TGX 18.440 Sattelzugmaschine"));
    expect(message.split("🔥")).toHaveLength(2);
  });
});

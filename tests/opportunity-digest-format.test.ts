import { describe, expect, it } from "vitest";
import { formatDigest } from "@/lib/services/opportunity-digest";

describe("Telegram opportunity digest localization", () => {
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
});

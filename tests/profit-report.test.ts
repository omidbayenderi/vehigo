import { describe, expect, it } from "vitest";
import { aggregateProfitReport } from "@/lib/services/offers";

const vehicleById = new Map([
  ["v1", { id: "v1", seller_country: "Germany", source_site: "mobile.de", brand: "Mercedes-Benz", model: "Actros" }],
  ["v2", { id: "v2", seller_country: "Germany", source_site: "mobile.de", brand: "Mercedes-Benz", model: "Actros" }],
  ["v3", { id: "v3", seller_country: "Netherlands", source_site: "marktplaats", brand: "MAN", model: "TGX" }],
]);

describe("aggregateProfitReport", () => {
  it("groups won deals by country/source/model and sums expected vs realized profit", () => {
    const rows = aggregateProfitReport(
      [
        { vehicle_id: "v1", closed_outcome: "won", commission_amount_calculated: 1000, actual_revenue: 30000, actual_total_cost: 28500 },
        { vehicle_id: "v2", closed_outcome: "won", commission_amount_calculated: 1200, actual_revenue: 31000, actual_total_cost: 29000 },
      ],
      vehicleById,
    );

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      country: "Germany",
      source: "mobile.de",
      model: "Mercedes-Benz Actros",
      wonCount: 2,
      lostCount: 0,
      expectedProfitSum: 2200,
      realizedProfitSum: 1500 + 2000,
      variance: 3500 - 2200,
    });
  });

  it("counts lost deals without adding them to profit sums", () => {
    const rows = aggregateProfitReport(
      [{ vehicle_id: "v3", closed_outcome: "lost", commission_amount_calculated: 800, actual_revenue: null, actual_total_cost: null }],
      vehicleById,
    );

    expect(rows[0].lostCount).toBe(1);
    expect(rows[0].wonCount).toBe(0);
    expect(rows[0].expectedProfitSum).toBe(0);
    expect(rows[0].realizedProfitSum).toBe(0);
  });

  it("falls back to 'Bilinmiyor' when the vehicle is missing", () => {
    const rows = aggregateProfitReport(
      [{ vehicle_id: null, closed_outcome: "won", commission_amount_calculated: 500, actual_revenue: 100, actual_total_cost: 50 }],
      vehicleById,
    );

    expect(rows[0].country).toBe("Bilinmiyor");
    expect(rows[0].source).toBe("Bilinmiyor");
    expect(rows[0].model).toBe("Bilinmiyor");
  });
});

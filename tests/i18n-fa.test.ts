import { describe, expect, it } from "vitest";
import { translateToFa } from "@/lib/i18n/fa";

describe("Persian interface translations", () => {
  it("translates core trading navigation fluently", () => {
    expect(translateToFa("Araçlar")).toBe("خودروها");
    expect(translateToFa("İlan alarmları")).toBe("هشدارهای آگهی");
    expect(translateToFa("Teklife başla")).toBe("شروع پیشنهاد");
  });

  it("translates dynamic opportunity counts without changing the number", () => {
    expect(translateToFa("12 yeni fırsat bekliyor")).toBe("12 فرصت تازه در انتظار بررسی است");
    expect(translateToFa("4 araç kısa listede")).toBe("4 خودرو در فهرست منتخب است");
  });

  it("leaves unknown user and vehicle data untouched", () => {
    expect(translateToFa("Mercedes-Benz Actros 1845")).toBe("Mercedes-Benz Actros 1845");
  });
});

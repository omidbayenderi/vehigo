import { afterEach, describe, expect, it } from "vitest";
import { isOperationsCronAuthorized } from "@/lib/operations/request-auth";

const originalSecret = process.env.CRON_SECRET;

afterEach(() => {
  if (originalSecret === undefined) delete process.env.CRON_SECRET;
  else process.env.CRON_SECRET = originalSecret;
});

describe("operations cron authorization", () => {
  it("accepts only the exact bearer credential", () => {
    process.env.CRON_SECRET = "maintenance-secret";
    expect(isOperationsCronAuthorized(new Request("https://vehigo.test", { headers: { authorization: "Bearer maintenance-secret" } }))).toBe(true);
    expect(isOperationsCronAuthorized(new Request("https://vehigo.test", { headers: { authorization: "Bearer wrong" } }))).toBe(false);
    expect(isOperationsCronAuthorized(new Request("https://vehigo.test"))).toBe(false);
  });

  it("fails closed when the environment secret is absent", () => {
    delete process.env.CRON_SECRET;
    expect(isOperationsCronAuthorized(new Request("https://vehigo.test", { headers: { authorization: "Bearer undefined" } }))).toBe(false);
  });
});

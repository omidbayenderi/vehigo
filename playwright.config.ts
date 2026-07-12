import { defineConfig } from "@playwright/test";
import path from "node:path";
import process from "node:process";

try {
  process.loadEnvFile(path.join(process.cwd(), ".env.test.local"));
} catch {
  // .env.test.local yoksa e2e testleri çalıştırılamaz; webServer başlatma hatası
  // bunu zaten net bir şekilde bildirecek.
}

export default defineConfig({
  testDir: "./e2e",
  testIgnore: "**/._*",
  // Generous: this drive cold-compiles each new Next.js route on first visit,
  // and this one test walks through ~8 distinct routes.
  timeout: 120_000,
  // Next dev on-demand-compiles each route on its first request; on this drive that
  // can comfortably exceed the 5s expect() default, especially right after a cache clear.
  expect: { timeout: 30_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  // The workspace lives on an exFAT drive. Playwright's recursive cleanup can
  // race macOS AppleDouble sidecars there, so keep disposable artifacts on the
  // local temporary filesystem instead.
  outputDir: process.env.PLAYWRIGHT_OUTPUT_DIR ?? "/tmp/vehigo-playwright-results",
  globalSetup: "./e2e/global-setup.ts",
  use: {
    baseURL: "http://localhost:3000",
    trace: "retain-on-failure",
  },
  webServer: {
    // Turbopack's persistence DB is unreliable on this exFAT workspace. Next.js
    // officially supports opting into webpack for local development/E2E.
    command: "npm run dev -- --webpack",
    url: "http://localhost:3000/login",
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
    env: {
      NEXT_PUBLIC_SUPABASE_URL: process.env.E2E_SUPABASE_URL ?? "",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.E2E_SUPABASE_ANON_KEY ?? "",
    },
  },
});

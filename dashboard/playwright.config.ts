import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright E2E configuration for timekeep Dashboard.
 *
 * Strategy:
 * - Tests run against the Vite dev server (localhost:5173)
 * - API calls are intercepted via page.route() — no real backend needed
 * - Chromium only (CI-friendly, fast)
 * - MSW is NOT used for E2E; Playwright's built-in route mocking is more reliable
 */
export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: "html",

  use: {
    baseURL: "http://localhost:5173",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],

  webServer: {
    command: "pnpm dev",
    url: "http://localhost:5173",
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
});

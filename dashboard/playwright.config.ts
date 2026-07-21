import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright E2E configuration for timekeep Dashboard.
 *
 * Strategy:
 * - Tests run against the Vite dev server (localhost:5173), which proxies /api to
 *   the Rust backend (localhost:3000).
 * - The Rust backend reads a seeded SQLite database (timekeep-e2e.db) generated
 *   by `make seed-e2e` before tests run.
 * - No API mocking — tests exercise the real Rust API, real auth, real data.
 * - Chromium only (CI-friendly, fast).
 *
 * Usage:
 *   make seed-e2e && cd dashboard && pnpm e2e
 *
 *   Or in one step:
 *   cd dashboard && pnpm e2e
 *   (globalSetup handles seeding automatically)
 */

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: "html",

  globalSetup: "./e2e/global-setup.ts",

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

  webServer: [
    // Rust backend — runs from the workspace root, uses the seeded E2E DB
    {
      command:
        "TIMEKEEP_E2E=1 cargo run -p timekeep --bin timekeep -- --db timekeep-e2e.db",
      cwd: "..",
      url: "http://localhost:3000/api/health",
      reuseExistingServer: !process.env.CI,
      timeout: 120_000, // Rust compilation can be slow
    },
    // Vite dev server — proxies /api to the Rust backend
    {
      command: "VITE_DISABLE_DEVTOOLS=1 pnpm dev",
      url: "http://localhost:5173",
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
    },
  ],
});

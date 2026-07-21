/**
 * Documentation Screenshot Capture Script.
 *
 * Two modes:
 *
 *   Mock mode (default):
 *     Intercepts all API calls via page.route(). Fast, deterministic,
 *     no backend needed.
 *     Usage: npx tsx docs-scripts/capture-flows.ts
 *
 *   Real backend mode (--real):
 *     Connects to a real Rust backend with seeded data. Screenshots
 *     reflect ACTUAL database state.
 *     Usage: npx tsx docs-scripts/capture-flows.ts --real
 *
 * Credentials (must match seed binary output):
 *   admin    / admin123
 *   operator / operator123
 *   viewer   / viewer123
 */

import { chromium, type Browser, type Page } from "playwright";
import { existsSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { mockAllRoutes } from "./mock-data";
import { annotatedScreenshot } from "./annotations";

// ── Config ──────────────────────────────────────────────────────────

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCREENSHOTS_DIR = resolve(__dirname, "../../docs/screenshots");
const BASE_URL = process.env.BASE_URL ?? "http://localhost:5173";
const VIEWPORT = { width: 1440, height: 900 };
const USE_REAL_BACKEND = process.argv.includes("--real");

const CREDENTIALS = {
  admin:    { username: "admin",     password: "admin123" },
  operator: { username: "operator",  password: "operator123" },
  viewer:   { username: "viewer",    password: "viewer123" },
} as const;

if (!existsSync(SCREENSHOTS_DIR)) mkdirSync(SCREENSHOTS_DIR, { recursive: true });

// ── Helpers ─────────────────────────────────────────────────────────

function sp(filename: string): string {
  return resolve(SCREENSHOTS_DIR, filename);
}

async function loginAs(page: Page, username: string, password: string): Promise<void> {
  await page.goto(`${BASE_URL}/login`, { waitUntil: "domcontentloaded" });
  await page.getByPlaceholder(/admin/i).waitFor({ state: "visible", timeout: 10_000 });
  await page.getByPlaceholder(/admin/i).fill(username);
  await page.getByPlaceholder(/password/i).fill(password);

  // Click Sign in, then poll for navigation away from /login.
  // Retry on 429 (rate limit) with exponential backoff.
  for (let attempt = 0; attempt < 5; attempt++) {
    await page.getByRole("button", { name: /sign in/i }).click();

    let rateLimited = false;
    for (let i = 0; i < 40; i++) {
      await page.waitForTimeout(250);
      if (!page.url().includes("/login")) break;
      if (i === 39) {
        const errEl = page.locator('[role="alert"]');
        const msg = ((await errEl.isVisible().catch(() => false))
          ? await errEl.textContent().catch(() => "unknown")
          : "");
        if (msg.includes("429") || msg.includes("Too Many")) {
          rateLimited = true;
          break;
        }
        throw new Error(`Login stuck on ${page.url()} — ${msg}`);
      }
    }

    if (!rateLimited) break;
    // Rate limited — wait and retry
    const delay = Math.pow(2, attempt) * 1000;
    console.log(`   ⏳ Rate limited, retrying in ${delay / 1000}s...`);
    await page.goto(`${BASE_URL}/login`, { waitUntil: "domcontentloaded" });
    await page.getByPlaceholder(/admin/i).waitFor({ state: "visible", timeout: 10_000 });
    await page.getByPlaceholder(/admin/i).fill(username);
    await page.getByPlaceholder(/password/i).fill(password);
    await page.waitForTimeout(delay);
  }

  if (page.url().includes("/setup")) {
    throw new Error("Redirected to /setup — DB has no users. Run: make seed-db-reset");
  }
  await page.waitForTimeout(500);
}

async function navigateTo(page: Page, path: string): Promise<void> {
  await page.goto(`${BASE_URL}${path}`, {
    waitUntil: "domcontentloaded",
    timeout: 15_000,
  });
  await page.waitForSelector('[data-slot="app-shell"]', { timeout: 10_000 });
  // Wait for loading skeletons to disappear
  await page.waitForTimeout(800);
}

async function waitForContent(page: Page): Promise<void> {
  // Wait for any visible loading skeleton to disappear, plus a grace tick for render
  const skeleton = page.locator('[aria-busy="true"], .react-loading-skeleton');
  await skeleton.first().waitFor({ state: "hidden", timeout: 15_000 }).catch(() => {
    // No skeleton visible — page already loaded
  });
  await page.waitForTimeout(300);
}

async function goToDashboard(page: Page): Promise<void> {
  await page.goto(`${BASE_URL}/`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector('[data-slot="app-shell"]', { timeout: 10_000 });
  await waitForContent(page);
}

// ── Admin ───────────────────────────────────────────────────────────

async function captureAdminWorkflows(browser: Browser): Promise<string[]> {
  const ctx = await browser.newContext({ viewport: VIEWPORT });
  const page = await ctx.newPage();
  const captured: string[] = [];
  if (!USE_REAL_BACKEND) await mockAllRoutes(page, "admin");
  await loginAs(page, CREDENTIALS.admin.username, CREDENTIALS.admin.password);

  await goToDashboard(page);
  await annotatedScreenshot(page, sp("admin-01-dashboard.png"), [
    { locator: page.getByText("Present"), number: 1 },
    { locator: page.getByText("Absent"), number: 2 },
    { locator: page.getByText("Late"), number: 3 },
  ]);
  captured.push("admin-01-dashboard.png");

  await navigateTo(page, "/devices");
  await waitForContent(page);
  await annotatedScreenshot(page, sp("admin-02-device-list.png"), [
    { locator: page.getByText("Office Entrance"), number: 1 },
  ]);
  captured.push("admin-02-device-list.png");

  await navigateTo(page, "/devices/CQZ7232960836");
  await waitForContent(page);
  await annotatedScreenshot(page, sp("admin-03-device-detail.png"), []);
  captured.push("admin-03-device-detail.png");

  await navigateTo(page, "/employees");
  await waitForContent(page);
  await annotatedScreenshot(page, sp("admin-04-employee-list.png"), []);
  captured.push("admin-04-employee-list.png");

  await navigateTo(page, "/settings/users");
  await waitForContent(page);
  await annotatedScreenshot(page, sp("admin-05-settings-users.png"), []);
  captured.push("admin-05-settings-users.png");

  await navigateTo(page, "/departments");
  await waitForContent(page);
  await annotatedScreenshot(page, sp("admin-06-departments.png"), []);
  captured.push("admin-06-departments.png");

  await ctx.close();
  console.log("  ✅ Admin workflows captured (6 screenshots)");
  return captured;
}

// ── HR (Operator) ───────────────────────────────────────────────────

async function captureHRWorkflows(browser: Browser): Promise<string[]> {
  const ctx = await browser.newContext({ viewport: VIEWPORT });
  const page = await ctx.newPage();
  const captured: string[] = [];
  if (!USE_REAL_BACKEND) await mockAllRoutes(page, "operator");
  await loginAs(page, CREDENTIALS.operator.username, CREDENTIALS.operator.password);

  // H01 — Dashboard with KPIs
  await goToDashboard(page);
  await annotatedScreenshot(page, sp("hr-01-dashboard.png"), [
    { locator: page.getByText("Present"), number: 1 },
    { locator: page.getByText("Absent"), number: 2 },
    { locator: page.getByText("Late"), number: 3 },
  ]);
  captured.push("hr-01-dashboard.png");

  // H02 — Employee list
  await navigateTo(page, "/employees");
  await waitForContent(page);
  await annotatedScreenshot(page, sp("hr-02-employee-list.png"), [
    { locator: page.getByPlaceholder(/search/i).or(page.getByRole("searchbox")), number: 1 },
    { locator: page.getByText("Attendance").first(), number: 2 },
  ]);
  captured.push("hr-02-employee-list.png");

  // H03 — Employee detail (navigate to first employee if possible)
  // The employee detail page requires a valid employee ID from the seeded data.
  // In mock mode, we have known UUIDs. In real mode, we try the first row.
  // For now, capture the list as fallback if the first employee link isn't known.
  await navigateTo(page, "/employees");
  await waitForContent(page);
  // Try clicking the first employee row to get to detail
  const firstEmpRow = page.locator("table tbody tr, [data-employee-row]").first();
  const hasEmployeeRow = await firstEmpRow.isVisible().catch(() => false);
  if (hasEmployeeRow) {
    await firstEmpRow.click();
    await waitForContent(page);
    await annotatedScreenshot(page, sp("hr-03-employee-detail.png"), [
      { locator: page.getByText("Attendance").first(), number: 1 },
      { locator: page.getByText("Calendar").or(page.getByText("Heatmap")).first(), number: 2 },
    ]);
  } else {
    // Fallback: capture the list page
    await annotatedScreenshot(page, sp("hr-03-employee-detail.png"), [
      { locator: page.getByPlaceholder(/search/i).or(page.getByRole("searchbox")), number: 1 },
    ]);
  }
  captured.push("hr-03-employee-detail.png");

  // H04 — Attendance (all punches)
  await navigateTo(page, "/attendance");
  await waitForContent(page);
  await annotatedScreenshot(page, sp("hr-04-attendance.png"), [
    { locator: page.getByText("Check In").or(page.getByText("Check Out")).first(), number: 1 },
    { locator: page.getByText("Filter").or(page.getByPlaceholder(/filter/i)).first(), number: 2 },
  ]);
  captured.push("hr-04-attendance.png");

  // H05 — Reports
  await navigateTo(page, "/reports");
  await waitForContent(page);
  await annotatedScreenshot(page, sp("hr-05-reports.png"), [
    { locator: page.getByText("Period").or(page.getByText("This Month")).first(), number: 1 },
    { locator: page.getByText("Export").or(page.getByText("Download")).first(), number: 2 },
  ]);
  captured.push("hr-05-reports.png");

  // H06 — Departments list
  await navigateTo(page, "/departments");
  await waitForContent(page);
  await annotatedScreenshot(page, sp("hr-06-departments.png"), [
    { locator: page.getByText("Employees").first(), number: 1 },
    { locator: page.getByText("Custom Policy").or(page.getByText("Work Policy")).first(), number: 2 },
  ]);
  captured.push("hr-06-departments.png");

  // H07 — Sidebar navigation (HR perspective)
  await goToDashboard(page);
  await annotatedScreenshot(page, sp("hr-07-navigation.png"), [
    { locator: page.getByText("Dashboard").first(), number: 1 },
    { locator: page.getByText("Employees").first(), number: 2 },
    { locator: page.getByText("Attendance").first(), number: 3 },
    { locator: page.getByText("Reports").first(), number: 4 },
  ]);
  captured.push("hr-07-navigation.png");

  await ctx.close();
  console.log("  ✅ HR workflows captured (7 screenshots)");
  return captured;
}

// ── Supervisor (Viewer) ─────────────────────────────────────────────

async function captureSupervisorWorkflows(browser: Browser): Promise<string[]> {
  const ctx = await browser.newContext({ viewport: VIEWPORT });
  const page = await ctx.newPage();
  const captured: string[] = [];
  if (!USE_REAL_BACKEND) await mockAllRoutes(page, "viewer");
  await loginAs(page, CREDENTIALS.viewer.username, CREDENTIALS.viewer.password);

  // S01 — Dashboard
  await goToDashboard(page);
  await annotatedScreenshot(page, sp("supervisor-01-dashboard.png"), [
    { locator: page.getByText("Present"), number: 1 },
    { locator: page.getByText("Absent"), number: 2 },
    { locator: page.getByText("Late"), number: 3 },
  ]);
  captured.push("supervisor-01-dashboard.png");

  // S02 — Employee list (team view)
  await navigateTo(page, "/employees");
  await waitForContent(page);
  await annotatedScreenshot(page, sp("supervisor-02-employee-list.png"), [
    { locator: page.getByPlaceholder(/search/i).or(page.getByRole("searchbox")), number: 1 },
    { locator: page.getByText("Attendance").first(), number: 2 },
  ]);
  captured.push("supervisor-02-employee-list.png");

  // S03 — Employee detail
  await navigateTo(page, "/employees");
  await waitForContent(page);
  const supEmpRow = page.locator("table tbody tr, [data-employee-row]").first();
  const supHasRow = await supEmpRow.isVisible().catch(() => false);
  if (supHasRow) {
    await supEmpRow.click();
    await waitForContent(page);
    await annotatedScreenshot(page, sp("supervisor-03-employee-detail.png"), [
      { locator: page.getByText("Attendance").first(), number: 1 },
      { locator: page.getByText("Calendar").or(page.getByText("Heatmap")).first(), number: 2 },
    ]);
  } else {
    await annotatedScreenshot(page, sp("supervisor-03-employee-detail.png"), [
      { locator: page.getByPlaceholder(/search/i).or(page.getByRole("searchbox")), number: 1 },
    ]);
  }
  captured.push("supervisor-03-employee-detail.png");

  // S04 — Attendance browse
  await navigateTo(page, "/attendance");
  await waitForContent(page);
  await annotatedScreenshot(page, sp("supervisor-04-attendance.png"), [
    { locator: page.getByText("Check In").or(page.getByText("Check Out")).first(), number: 1 },
    { locator: page.getByText("Filter").or(page.getByPlaceholder(/filter/i)).first(), number: 2 },
  ]);
  captured.push("supervisor-04-attendance.png");

  // S05 — Reports (read-only)
  await navigateTo(page, "/reports");
  await waitForContent(page);
  await annotatedScreenshot(page, sp("supervisor-05-reports.png"), [
    { locator: page.getByText("Period").or(page.getByText("This Month")).first(), number: 1 },
  ]);
  captured.push("supervisor-05-reports.png");

  // S06 — Navigation sidebar (supervisor perspective)
  await goToDashboard(page);
  await annotatedScreenshot(page, sp("supervisor-06-navigation.png"), [
    { locator: page.getByText("Dashboard").first(), number: 1 },
    { locator: page.getByText("Employees").first(), number: 2 },
    { locator: page.getByText("Attendance").first(), number: 3 },
    { locator: page.getByText("Reports").first(), number: 4 },
  ]);
  captured.push("supervisor-06-navigation.png");

  await ctx.close();
  console.log("  ✅ Supervisor workflows captured (6 screenshots)");
  return captured;
}

// ── Main ────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const mode = USE_REAL_BACKEND ? "REAL BACKEND (seeded DB)" : "MOCK (API interception)";
  const totalExpected = USE_REAL_BACKEND ? 19 : 19;
  console.log(`📸 timekeep Documentation Screenshot Capture [${mode}]`);
  console.log(`   Base URL: ${BASE_URL}`);
  console.log(`   Output:   ${SCREENSHOTS_DIR}`);
  if (USE_REAL_BACKEND) {
    console.log(`   Admin:    ${CREDENTIALS.admin.username} / ${CREDENTIALS.admin.password}`);
    console.log(`   Operator: ${CREDENTIALS.operator.username} / ${CREDENTIALS.operator.password}`);
    console.log(`   Viewer:   ${CREDENTIALS.viewer.username} / ${CREDENTIALS.viewer.password}`);
  }
  console.log();

  const browser = await chromium.launch({ headless: true });
  try {
    const all: string[] = [];

    console.log("🛡️  Admin workflows...");
    all.push(...(await captureAdminWorkflows(browser)));
    await new Promise((r) => setTimeout(r, 2000));

    console.log("\n👥 HR (operator) workflows...");
    all.push(...(await captureHRWorkflows(browser)));
    await new Promise((r) => setTimeout(r, 2000));

    console.log("\n👁️  Supervisor (viewer) workflows...");
    all.push(...(await captureSupervisorWorkflows(browser)));

    console.log(`\n🎉 Done! ${all.length}/${totalExpected} screenshots captured:`);
    for (const f of all) console.log(`   ${f}`);
    if (!USE_REAL_BACKEND) {
      console.log("\n💡 Run with --real for production screenshots:");
      console.log("   make docs-screenshots-real");
    }
  } catch (err) {
    console.error("❌ Capture failed:", err);
    if (USE_REAL_BACKEND) {
      console.error("\n💡 Troubleshooting:");
      console.error("   1. Backend:  cargo run -p timekeep --bin timekeep -- --db timekeep-e2e.db");
      console.error("   2. DB seed:  make seed-e2e");
      console.error("   3. Frontend: cd dashboard && pnpm dev");
    }
    process.exit(1);
  } finally {
    await browser.close();
  }
}

main();

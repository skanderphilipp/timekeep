/**
 * HR Dashboard — WF-HR-01: Daily Attendance Monitoring
 *
 * User Story: As an HR manager, I want to see today's attendance at a glance
 * so that I can identify who is present, late, or absent within seconds of logging in.
 *
 * Acceptance Criteria:
 *   1. Dashboard loads within 3 seconds after login
 *   2. Present/Absent/Late counts are accurate and update in real time
 *   3. Clicking a KPI card shows the employee list filtered to that status
 *   4. Recent Activity feed shows the last 10 punches with timestamps
 */
import { test, expect } from "@playwright/test";
import { loginAs } from "../helpers/auth";

// ── Selector helpers ────────────────────────────────────────────────────────

const STAT_CARD = (variant: string) => `[data-slot="stat-card-${variant}"]`;
const STAT_VALUE = (variant: string) => `${STAT_CARD(variant)} [data-slot="stat-card-value"]`;

test.describe("HR Dashboard (WF-HR-01)", () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, "operator");
  });

  test("dashboard shows Present, Absent, and Late KPI cards after login", async ({ page }) => {
    // Verify we're on the dashboard
    await expect(page).toHaveURL(/\/$/);

    // Three KPI cards should be visible (stable data-slot selectors)
    await expect(page.locator(STAT_CARD("present"))).toBeVisible({ timeout: 5000 });
    await expect(page.locator(STAT_CARD("absent"))).toBeVisible({ timeout: 5000 });
    await expect(page.locator(STAT_CARD("late"))).toBeVisible({ timeout: 5000 });
  });

  test("KPI cards display numeric values", async ({ page }) => {
    // Verify the KPI cards contain numbers (not empty/loading states)
    const presentText = await page.locator(STAT_VALUE("present")).textContent();
    const absentText = await page.locator(STAT_VALUE("absent")).textContent();
    const lateText = await page.locator(STAT_VALUE("late")).textContent();

    // Each KPI should have a valid number
    expect(presentText).toMatch(/^\d+$/);
    expect(absentText).toMatch(/^\d+$/);
    expect(lateText).toMatch(/^\d+$/);
  });

  test("operator does NOT see admin-only navigation items", async ({ page }) => {
    // Operator SHOULD NOT see admin-restricted items (Device Groups, Settings sub-items)
    await expect(page.getByRole("link", { name: /device groups/i })).not.toBeVisible();

    // Operator SHOULD see common items
    await expect(page.getByRole("link", { name: /devices/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /employees/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /attendance/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /reports/i })).toBeVisible();
  });
});

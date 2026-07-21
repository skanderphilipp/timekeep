/**
 * Supervisor Dashboard — WF-SUP-01: Daily Team Check
 *
 * User Story: As a department supervisor, I want to see today's attendance
 * overview so that I know which team members are present, late, or absent.
 *
 * Acceptance Criteria:
 *   1. Dashboard loads with KPI cards for the entire organization
 *   2. Clicking a KPI card shows the employee list filtered to that status
 *   3. Supervisor cannot edit any data (no Correct button, no Edit button)
 */
import { test, expect } from "@playwright/test";
import { loginAs } from "../helpers/auth";

// ── Selector helpers ────────────────────────────────────────────────────────

const STAT_CARD = (variant: string) => `[data-slot="stat-card-${variant}"]`;
const STAT_VALUE = (variant: string) => `${STAT_CARD(variant)} [data-slot="stat-card-value"]`;

test.describe("Supervisor Dashboard (WF-SUP-01)", () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, "viewer");
  });

  test("dashboard shows Present, Absent, and Late KPI cards", async ({ page }) => {
    // Verify we're on the dashboard
    await expect(page).toHaveURL(/\/$/);

    // Three KPI cards should be visible (stable data-slot selectors)
    await expect(page.locator(STAT_CARD("present"))).toBeVisible({ timeout: 5000 });
    await expect(page.locator(STAT_CARD("absent"))).toBeVisible();
    await expect(page.locator(STAT_CARD("late"))).toBeVisible();
  });

  test("dashboard KPI cards display numeric values", async ({ page }) => {
    const presentText = await page.locator(STAT_VALUE("present")).textContent();
    const absentText = await page.locator(STAT_VALUE("absent")).textContent();
    const lateText = await page.locator(STAT_VALUE("late")).textContent();

    // Each KPI should have a valid number
    expect(presentText).toMatch(/^\d+$/);
    expect(absentText).toMatch(/^\d+$/);
    expect(lateText).toMatch(/^\d+$/);
  });

  test("supervisor does NOT see admin-only navigation items", async ({ page }) => {
    // Supervisor SHOULD NOT see admin-restricted items
    await expect(page.getByRole("link", { name: /device groups/i })).not.toBeVisible();
    await expect(page.getByRole("link", { name: /work policies/i })).not.toBeVisible({ timeout: 3000 });

    // Supervisor SHOULD see read-only items
    await expect(page.getByRole("link", { name: /devices/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /employees/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /attendance/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /reports/i })).toBeVisible();
  });
});

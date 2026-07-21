/**
 * Supervisor Reports — WF-SUP-04
 *
 * User Story: As a department supervisor, I want to view attendance reports
 * for any period so that I can track team trends over time.
 *
 * Acceptance Criteria:
 *   1. Period selector works
 *   2. Summary cards display correct data
 *   3. Charts render
 *   4. No Export button (viewers cannot export)
 */
import { test, expect } from "@playwright/test";
import { loginAs } from "../helpers/auth";

test.describe("Supervisor Reports (WF-SUP-04)", () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, "viewer");
  });

  test("reports page loads with period selector for viewer", async ({ page }) => {
    await page.goto("/reports");
    await page.waitForURL("/reports");

    // Period selector should be visible
    await expect(
      page.getByText(/period/i).or(page.getByText(/this month/i)).or(page.getByText(/this week/i))
    ).toBeVisible({ timeout: 5000 });
  });

  test("supervisor cannot export reports — no export button", async ({ page }) => {
    await page.goto("/reports");
    await page.waitForURL("/reports");

    // Viewers should NOT have export functionality
    await expect(page.getByRole("button", { name: /export/i })).not.toBeVisible();
  });
});

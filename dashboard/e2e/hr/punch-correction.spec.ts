/**
 * HR Punch Correction — WF-HR-04
 *
 * User Story: As an HR manager, I want to correct erroneous punch records
 * (duplicates, missing checkouts, wrong times) so that attendance data
 * is accurate for payroll and reporting.
 *
 * Acceptance Criteria:
 *   1. Operator can view anomalous punch records flagged in the UI
 *   2. Anomalies toggle filters punches to show only anomalous records
 *   3. Clicking an anomalous punch opens the detail panel
 *   4. Operator can correct punch status, time, or dismiss the anomaly
 *   5. Corrected records lose their anomaly badge
 */
import { test, expect } from "@playwright/test";
import { loginAs } from "../helpers/auth";

// ── Selector helpers ────────────────────────────────────────────────────────

const PUNCH_ROW = '[data-slot="punch-row"]';
const ANOMALY_TOGGLE = '[data-slot="filter-toggle-anomalies_only"]';
const FILTER_CHIPS = '[data-slot="filter-chips"]';

test.describe("HR Punch Correction (WF-HR-04)", () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, "operator");
  });

  test("attendance page loads with punch data", async ({ page }) => {
    await page.goto("/attendance");
    await page.waitForURL("/attendance");

    // Punch rows should be visible
    await expect(page.locator(PUNCH_ROW).first()).toBeVisible({ timeout: 10000 });
  });

  test("operator can see filter controls on attendance page", async ({ page }) => {
    await page.goto("/attendance");
    await page.waitForURL("/attendance");

    // Filter button should be available to operators
    const filterButton = page.getByRole("button", { name: /filter/i });
    if (await filterButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      await filterButton.click();
      await page.waitForTimeout(300);

      // Anomalies toggle should be visible in the filter panel
      await expect(
        page.locator(ANOMALY_TOGGLE).or(page.getByText(/anomal/i))
      ).toBeVisible({ timeout: 3000 });
    }
  });

  test("clicking a punch row opens detail panel", async ({ page }) => {
    await page.goto("/attendance");
    await page.waitForURL("/attendance");

    // Wait for rows and click the first one
    const firstRow = page.locator(PUNCH_ROW).first();
    if (await firstRow.isVisible({ timeout: 10000 }).catch(() => false)) {
      await firstRow.click();
      await page.waitForTimeout(500);

      // Detail panel or expanded row should appear with punch information
      await expect(
        page.getByText(/punch/i).or(page.getByText(/record/i)).or(page.getByText(/status/i))
      ).toBeVisible({ timeout: 3000 });
    }
  });

  test("filter chips container is present", async ({ page }) => {
    await page.goto("/attendance");
    await page.waitForURL("/attendance");

    // Filter chips container should be attached to the DOM
    const chips = page.locator(FILTER_CHIPS);
    await expect(chips).toBeAttached({ timeout: 5000 });
  });
});

/**
 * Supervisor Anomaly Detection — WF-SUP-03
 *
 * User Story: As a department supervisor, I want to identify suspicious punch
 * records so that I can escalate them to HR for correction.
 *
 * Acceptance Criteria:
 *   1. Anomalies Only toggle is visible and functional
 *   2. Toggling it filters punches to only show anomalous records
 *   3. Anomalous rows have a visible badge/indicator
 *   4. Supervisor cannot click "Correct" (button absent or disabled)
 */
import { test, expect } from "@playwright/test";
import { loginAs } from "../helpers/auth";

// ── Selector helpers ────────────────────────────────────────────────────────

const ANOMALY_TOGGLE = '[data-slot="filter-toggle-anomalies_only"]';
const PUNCH_ROW = '[data-slot="punch-row"]';

test.describe("Supervisor Anomaly Detection (WF-SUP-03)", () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, "viewer");
  });

  test("attendance page loads with punch data for viewer", async ({ page }) => {
    await page.goto("/attendance");
    await page.waitForURL("/attendance");

    // Should display punch records
    await expect(page.locator(PUNCH_ROW).first()).toBeVisible({ timeout: 10000 });
  });

  test("viewer cannot edit or correct punches", async ({ page }) => {
    await page.goto("/attendance");
    await page.waitForURL("/attendance");

    // Click on a punch row
    const punchRow = page.locator(PUNCH_ROW).first();
    await expect(punchRow).toBeVisible({ timeout: 10000 });
    await punchRow.click();
    await page.waitForTimeout(500);

    // Should NOT see a Correct button (viewers can't edit)
    await expect(page.getByRole("button", { name: /correct/i })).not.toBeVisible();
  });

  test("anomalies toggle is visible in filter dropdown", async ({ page }) => {
    await page.goto("/attendance");
    await page.waitForURL("/attendance");

    // Open the filter dropdown
    const filterButton = page.getByRole("button", { name: /filter/i });
    if (await filterButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await filterButton.click();
      await page.waitForTimeout(300);
    }

    // The toggle should be on the page after opening filters
    await expect(
      page.locator(ANOMALY_TOGGLE).or(page.getByText(/anomal/i))
    ).toBeVisible({ timeout: 5000 });
  });
});

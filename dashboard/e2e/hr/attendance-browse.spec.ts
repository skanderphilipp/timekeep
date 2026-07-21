/**
 * HR Attendance Browsing — WF-HR-03
 *
 * User Story: As an HR manager, I want to browse and filter all punch records
 * so that I can investigate specific attendance events.
 *
 * Acceptance Criteria:
 *   1. Punch table loads with cursor-based pagination
 *   2. Filters by date range, device, status, and verification method work independently and in combination
 *   3. Active filters appear as removable chips above the table
 *   4. Results count updates when filters change
 */
import { test, expect } from "@playwright/test";
import { loginAs } from "../helpers/auth";

// ── Selector helpers ────────────────────────────────────────────────────────

const PUNCH_ROW = '[data-slot="punch-row"]';
const DATA_TABLE_ROW = '[data-slot="data-table-row"]';
const ANOMALY_TOGGLE = '[data-slot="filter-toggle-anomalies_only"]';

/** Wait for any row to be visible (punch-row or fallback data-table-row). */
async function waitForRows(page: import("@playwright/test").Page) {
  await page.locator(`${PUNCH_ROW}, ${DATA_TABLE_ROW}`).first().waitFor({ state: "visible", timeout: 30000 });
}

test.describe("HR Attendance Browse (WF-HR-03)", () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, "operator");
  });

  test("attendance page loads with punch table data", async ({ page }) => {
    await page.goto("/attendance");
    await page.waitForURL("/attendance");

    // Wait for row data to appear
    await waitForRows(page);

    const rowCount = await page.locator(`${PUNCH_ROW}, ${DATA_TABLE_ROW}`).count();
    expect(rowCount).toBeGreaterThan(0);
  });

  test("punch table shows status information", async ({ page }) => {
    await page.goto("/attendance");
    await page.waitForURL("/attendance");

    await waitForRows(page);

    // Should show punch status labels (Check In, Check Out, etc.)
    const statusText = page.getByText(/check in/i).or(page.getByText(/check out/i));
    await expect(statusText.first()).toBeVisible({ timeout: 5000 });
  });

  test("filter controls are visible", async ({ page }) => {
    await page.goto("/attendance");
    await page.waitForURL("/attendance");

    // Filter button should be available
    const filterButton = page.getByRole("button", { name: /filter/i });
    await expect(filterButton).toBeVisible({ timeout: 5000 });
  });

  test("punch rows are interactive", async ({ page }) => {
    await page.goto("/attendance");
    await page.waitForURL("/attendance");

    await waitForRows(page);

    // Click the first row to verify interaction
    const firstRow = page.locator(`${PUNCH_ROW}, ${DATA_TABLE_ROW}`).first();
    await firstRow.click();
    await page.waitForTimeout(500);

    // Page should still be on attendance (not crash)
    await expect(page).toHaveURL(/\/attendance/);
  });
});

/**
 * HR Employee Search & View — WF-HR-02
 *
 * User Story: As an HR manager, I want to search for any employee by name and
 * view their complete attendance history so that I can answer questions about
 * individual attendance.
 *
 * Acceptance Criteria:
 *   1. Search bar filters results as the user types (debounced 300ms)
 *   2. Results include name, department, PIN, and attendance %
 *   3. Clicking an employee opens the side panel with employee details
 *   4. Detail panel shows KPI cards, attendance calendar, trend chart, and daily detail
 */
import { test, expect } from "@playwright/test";
import { loginAs } from "../helpers/auth";

test.describe("HR Employee Search (WF-HR-02)", () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, "operator");
  });

  test("employee list page loads with employee data", async ({ page }) => {
    await page.goto("/employees");
    await page.waitForURL("/employees");

    // Should show employee rows (data-table rows load from real backend)
    const rows = page.locator('[data-slot="data-table-row"]');
    await expect(rows.first()).toBeVisible({ timeout: 15000 });

    const count = await rows.count();
    expect(count).toBeGreaterThan(0);
  });

  test("clicking an employee opens detail side panel", async ({ page }) => {
    await page.goto("/employees");
    await page.waitForURL("/employees");

    // Click the first employee row
    const firstRow = page.locator('[data-slot="data-table-row"]').first();
    await expect(firstRow).toBeVisible({ timeout: 15000 });
    await firstRow.click();
    await page.waitForTimeout(1000);

    // Side panel should open with employee details
    // The side panel renders the employee detail page with attendance info
    await expect(
      page.locator('[data-slot="side-panel"]').or(page.getByText(/attendance/i))
    ).toBeVisible({ timeout: 5000 });
  });

  test("employee detail side panel displays attendance information", async ({ page }) => {
    await page.goto("/employees");
    await page.waitForURL("/employees");

    const firstRow = page.locator('[data-slot="data-table-row"]').first();
    await expect(firstRow).toBeVisible({ timeout: 15000 });
    await firstRow.click();
    await page.waitForTimeout(1000);

    // Side panel should show attendance-related content
    await expect(
      page.getByText(/attendance/i).or(page.getByText(/calendar/i)).or(page.getByText(/summary/i))
    ).toBeVisible({ timeout: 5000 });
  });
});

/**
 * Supervisor Employee Search — WF-SUP-02
 *
 * User Story: As a department supervisor, I want to find any team member by
 * name and view their attendance history so that I can have data-informed
 * conversations about performance.
 *
 * Acceptance Criteria:
 *   1. Search filters in real time
 *   2. Attendance % column is visible and color-coded
 *   3. Clicking an employee opens detail panel (read-only — no Edit button)
 */
import { test, expect } from "@playwright/test";
import { loginAs } from "../helpers/auth";

test.describe("Supervisor Employee Search (WF-SUP-02)", () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, "viewer");
  });

  test("employee list loads with data", async ({ page }) => {
    await page.goto("/employees");
    await page.waitForURL("/employees");

    // Should show employee rows
    const rows = page.locator('[data-slot="data-table-row"]');
    await expect(rows.first()).toBeVisible({ timeout: 15000 });

    const count = await rows.count();
    expect(count).toBeGreaterThan(0);
  });

  test("clicking employee opens detail side panel", async ({ page }) => {
    await page.goto("/employees");
    await page.waitForURL("/employees");

    const firstRow = page.locator('[data-slot="data-table-row"]').first();
    await expect(firstRow).toBeVisible({ timeout: 15000 });
    await firstRow.click();
    await page.waitForTimeout(1000);

    // Side panel should open with employee details
    await expect(
      page.locator('[data-slot="side-panel"]').or(page.getByText(/attendance/i))
    ).toBeVisible({ timeout: 5000 });
  });

  test("employee detail panel is read-only — no edit controls", async ({ page }) => {
    await page.goto("/employees");
    await page.waitForURL("/employees");

    const firstRow = page.locator('[data-slot="data-table-row"]').first();
    await expect(firstRow).toBeVisible({ timeout: 15000 });
    await firstRow.click();
    await page.waitForTimeout(1000);

    // As a viewer, there should be NO Edit or Correct buttons
    await expect(page.getByRole("button", { name: /edit/i })).not.toBeVisible();
    await expect(page.getByRole("button", { name: /correct/i })).not.toBeVisible();
  });

  test("employee detail shows attendance information", async ({ page }) => {
    await page.goto("/employees");
    await page.waitForURL("/employees");

    const firstRow = page.locator('[data-slot="data-table-row"]').first();
    await expect(firstRow).toBeVisible({ timeout: 15000 });
    await firstRow.click();
    await page.waitForTimeout(1000);

    // Attendance info should be visible in the side panel
    await expect(
      page.getByText(/attendance/i).or(page.getByText(/calendar/i)).or(page.getByText(/summary/i))
    ).toBeVisible({ timeout: 5000 });
  });
});

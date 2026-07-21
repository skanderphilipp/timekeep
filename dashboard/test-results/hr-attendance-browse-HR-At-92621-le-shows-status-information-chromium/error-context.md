# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: hr/attendance-browse.spec.ts >> HR Attendance Browse (WF-HR-03) >> punch table shows status information
- Location: e2e/hr/attendance-browse.spec.ts:43:3

# Error details

```
TimeoutError: locator.waitFor: Timeout 30000ms exceeded.
Call log:
  - waiting for locator('[data-slot="punch-row"], [data-slot="data-table-row"]').first() to be visible

```

# Page snapshot

```yaml
- generic [ref=e3]:
  - link "Skip to content" [ref=e4] [cursor=pointer]:
    - /url: "#main-content"
  - complementary [ref=e5]:
    - generic [ref=e6]:
      - generic [ref=e7]:
        - img "TimeKeep" [ref=e8]
        - generic [ref=e12]:
          - generic [ref=e13]: TimeKeep
          - generic [ref=e14]: Alsabah
      - generic [ref=e15]:
        - button "Search (Cmd+K)" [ref=e16] [cursor=pointer]:
          - img [ref=e17]
        - button "Collapse sidebar" [ref=e20] [cursor=pointer]:
          - img [ref=e21]
    - navigation [ref=e23]:
      - link "Dashboard" [ref=e24] [cursor=pointer]:
        - /url: /
        - img [ref=e25]
        - generic [ref=e29]: Dashboard
      - generic [ref=e30]:
        - button "Devices" [ref=e31] [cursor=pointer]:
          - img [ref=e32]
          - generic [ref=e35]: Devices
          - img [ref=e36]
        - link "All Devices" [ref=e38] [cursor=pointer]:
          - /url: /devices
          - generic [ref=e39]: All Devices
      - link "Attendance" [ref=e40] [cursor=pointer]:
        - /url: /attendance
        - img [ref=e41]
        - generic [ref=e47]: Attendance
      - link "Employees" [ref=e48] [cursor=pointer]:
        - /url: /employees
        - img [ref=e49]
        - generic [ref=e54]: Employees
      - link "Reports" [ref=e55] [cursor=pointer]:
        - /url: /reports
        - img [ref=e56]
        - generic [ref=e62]: Reports
      - generic [ref=e63]:
        - button "Settings" [ref=e64] [cursor=pointer]:
          - img [ref=e65]
          - generic [ref=e68]: Settings
          - img [ref=e69]
        - generic:
          - link "System" [ref=e71] [cursor=pointer]:
            - /url: /settings
            - generic [ref=e72]: System
          - link "Users" [ref=e73] [cursor=pointer]:
            - /url: /settings/users
            - generic [ref=e74]: Users
          - link "API Keys" [ref=e75] [cursor=pointer]:
            - /url: /settings/api-keys
            - generic [ref=e76]: API Keys
          - link "Endpoints" [ref=e77] [cursor=pointer]:
            - /url: /settings/endpoints
            - generic [ref=e78]: Endpoints
          - link "Audit Log" [ref=e79] [cursor=pointer]:
            - /url: /settings/audit
            - generic [ref=e80]: Audit Log
    - generic [ref=e82]:
      - combobox "Switch language" [ref=e84] [cursor=pointer]:
        - option "English" [selected]
        - option "العربية"
        - option "Français"
      - button "Toggle theme" [ref=e85] [cursor=pointer]:
        - img [ref=e86]
      - generic [ref=e88]: Operator
      - button "Sign out" [ref=e89] [cursor=pointer]:
        - img [ref=e90]
  - generic [ref=e94]:
    - banner [ref=e95]:
      - navigation "Breadcrumb" [ref=e96]:
        - navigation "Breadcrumb" [ref=e97]:
          - generic [ref=e99]: Attendance
      - button "Search commands (Cmd+K)" [ref=e100] [cursor=pointer]:
        - generic [ref=e101]:
          - generic [ref=e102]: ⌘
          - generic [ref=e103]: K
    - generic [ref=e104]:
      - main [ref=e105]:
        - generic [ref=e108]:
          - generic [ref=e109]:
            - heading "Punch Records" [level=2] [ref=e110]
            - paragraph [ref=e111]: Query and filter all attendance punch records.
          - generic [ref=e112]:
            - generic [ref=e113]:
              - generic [ref=e114]:
                - generic [ref=e116]:
                  - button "Table" [pressed] [ref=e117] [cursor=pointer]:
                    - img [ref=e119]
                    - generic [ref=e121]: Table
                  - button "Timeline" [ref=e122] [cursor=pointer]:
                    - img [ref=e124]
                    - generic [ref=e130]: Timeline
                  - button "Calendar" [ref=e131] [cursor=pointer]:
                    - img [ref=e133]
                    - generic [ref=e135]: Calendar
                - generic [ref=e137]:
                  - img [ref=e139]
                  - textbox "Search by employee name or PIN…" [ref=e142]
                - generic [ref=e143]:
                  - generic [ref=e144]: 0 results
                  - button "Reset" [ref=e145] [cursor=pointer]:
                    - img [ref=e146]
                    - text: Reset
                  - button "Filter" [ref=e149] [cursor=pointer]:
                    - img [ref=e150]
                    - generic [ref=e152]: Filter
                  - button "Options" [ref=e154] [cursor=pointer]:
                    - img [ref=e155]
                    - generic [ref=e159]: Options
              - generic [ref=e161]:
                - generic [ref=e162]:
                  - generic [ref=e163]: From 2026-07-22
                  - button "Remove From 2026-07-22" [ref=e164] [cursor=pointer]:
                    - img [ref=e165]
                - generic [ref=e168]:
                  - generic [ref=e169]: To 2026-07-22
                  - button "Remove To 2026-07-22" [ref=e170] [cursor=pointer]:
                    - img [ref=e171]
            - generic [ref=e174]:
              - img [ref=e176]
              - heading "No punch records found" [level=3] [ref=e181]
              - paragraph [ref=e182]: No punch records match the current filters. Try adjusting or clearing them.
      - complementary [ref=e183]:
        - button [ref=e186] [cursor=pointer]:
          - img [ref=e187]
```

# Test source

```ts
  1  | /**
  2  |  * HR Attendance Browsing — WF-HR-03
  3  |  *
  4  |  * User Story: As an HR manager, I want to browse and filter all punch records
  5  |  * so that I can investigate specific attendance events.
  6  |  *
  7  |  * Acceptance Criteria:
  8  |  *   1. Punch table loads with cursor-based pagination
  9  |  *   2. Filters by date range, device, status, and verification method work independently and in combination
  10 |  *   3. Active filters appear as removable chips above the table
  11 |  *   4. Results count updates when filters change
  12 |  */
  13 | import { test, expect } from "@playwright/test";
  14 | import { loginAs } from "../helpers/auth";
  15 | 
  16 | // ── Selector helpers ────────────────────────────────────────────────────────
  17 | 
  18 | const PUNCH_ROW = '[data-slot="punch-row"]';
  19 | const DATA_TABLE_ROW = '[data-slot="data-table-row"]';
  20 | const ANOMALY_TOGGLE = '[data-slot="filter-toggle-anomalies_only"]';
  21 | 
  22 | /** Wait for any row to be visible (punch-row or fallback data-table-row). */
  23 | async function waitForRows(page: import("@playwright/test").Page) {
> 24 |   await page.locator(`${PUNCH_ROW}, ${DATA_TABLE_ROW}`).first().waitFor({ state: "visible", timeout: 30000 });
     |                                                                 ^ TimeoutError: locator.waitFor: Timeout 30000ms exceeded.
  25 | }
  26 | 
  27 | test.describe("HR Attendance Browse (WF-HR-03)", () => {
  28 |   test.beforeEach(async ({ page }) => {
  29 |     await loginAs(page, "operator");
  30 |   });
  31 | 
  32 |   test("attendance page loads with punch table data", async ({ page }) => {
  33 |     await page.goto("/attendance");
  34 |     await page.waitForURL("/attendance");
  35 | 
  36 |     // Wait for row data to appear
  37 |     await waitForRows(page);
  38 | 
  39 |     const rowCount = await page.locator(`${PUNCH_ROW}, ${DATA_TABLE_ROW}`).count();
  40 |     expect(rowCount).toBeGreaterThan(0);
  41 |   });
  42 | 
  43 |   test("punch table shows status information", async ({ page }) => {
  44 |     await page.goto("/attendance");
  45 |     await page.waitForURL("/attendance");
  46 | 
  47 |     await waitForRows(page);
  48 | 
  49 |     // Should show punch status labels (Check In, Check Out, etc.)
  50 |     const statusText = page.getByText(/check in/i).or(page.getByText(/check out/i));
  51 |     await expect(statusText.first()).toBeVisible({ timeout: 5000 });
  52 |   });
  53 | 
  54 |   test("filter controls are visible", async ({ page }) => {
  55 |     await page.goto("/attendance");
  56 |     await page.waitForURL("/attendance");
  57 | 
  58 |     // Filter button should be available
  59 |     const filterButton = page.getByRole("button", { name: /filter/i });
  60 |     await expect(filterButton).toBeVisible({ timeout: 5000 });
  61 |   });
  62 | 
  63 |   test("punch rows are interactive", async ({ page }) => {
  64 |     await page.goto("/attendance");
  65 |     await page.waitForURL("/attendance");
  66 | 
  67 |     await waitForRows(page);
  68 | 
  69 |     // Click the first row to verify interaction
  70 |     const firstRow = page.locator(`${PUNCH_ROW}, ${DATA_TABLE_ROW}`).first();
  71 |     await firstRow.click();
  72 |     await page.waitForTimeout(500);
  73 | 
  74 |     // Page should still be on attendance (not crash)
  75 |     await expect(page).toHaveURL(/\/attendance/);
  76 |   });
  77 | });
  78 | 
```
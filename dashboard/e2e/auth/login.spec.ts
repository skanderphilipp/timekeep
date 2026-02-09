/**
 * Auth flow E2E tests.
 *
 * Covers: login success, login failure, unauthenticated redirect, JWT persistence,
 * and 401 handling. All API calls are intercepted via Playwright page.route().
 */
import { test, expect, type Page } from "@playwright/test";

// ── API Mock Helpers ──────────────────────────────────────────────────────────

const VALID_CREDENTIALS = { username: "admin", password: "admin" };
const MOCK_JWT =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30._test_";

/** Sets up all API mocks on the given page. */
async function mockApi(page: Page) {
  // Login success (valid credentials)
  await page.route("**/api/auth/login", async (route) => {
    const body = JSON.parse(route.request().postData() ?? "{}");
    if (
      body.username === VALID_CREDENTIALS.username &&
      body.password === VALID_CREDENTIALS.password
    ) {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          token: MOCK_JWT,
          expires_in: 86400,
          token_type: "Bearer",
        }),
      });
    }
    return route.fulfill({
      status: 401,
      contentType: "application/json",
      body: JSON.stringify({ error: "Invalid credentials" }),
    });
  });

  // Dashboard data (needed after login redirect)
  await page.route("**/api/dashboard/today", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        date: "2026-07-10",
        present: 42,
        total_punches: 84,
        check_ins: 42,
        check_outs: 42,
        absent: 8,
        late: 3,
        total_employees: 50,
        last_punch_at: Date.now() / 1000,
      }),
    }),
  );

  // Devices
  await page.route("**/api/devices", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ devices: [], count: 0 }),
    }),
  );
}

// ── Tests ────────────────────────────────────────────────────────────────────

test.describe("Authentication", () => {
  test("redirects to login when unauthenticated", async ({ page }) => {
    await mockApi(page);
    await page.goto("/devices");

    // Should be redirected to /login with returnUrl param
    await expect(page).toHaveURL(/\/login/);

    // Login form should be visible
    await expect(
      page.getByRole("heading", { name: /sign in/i }),
    ).toBeVisible();
  });

  test("logins with valid credentials and redirects to dashboard", async ({
    page,
  }) => {
    await mockApi(page);
    await page.goto("/login");

    // Fill in credentials
    await page.getByLabel(/username/i).fill(VALID_CREDENTIALS.username);
    await page.getByLabel(/password/i).fill(VALID_CREDENTIALS.password);
    await page.getByRole("button", { name: /sign in/i }).click();

    // Should redirect away from login (default redirect is dashboard)
    await expect(page).not.toHaveURL(/\/login/);

    // JWT should be persisted in localStorage
    const token = await page.evaluate(() => localStorage.getItem("authToken"));
    expect(token).toBe(MOCK_JWT);
  });

  test("shows error on invalid credentials", async ({ page }) => {
    await mockApi(page);
    await page.goto("/login");

    await page.getByLabel(/username/i).fill("wrong");
    await page.getByLabel(/password/i).fill("wrong");
    await page.getByRole("button", { name: /sign in/i }).click();

    // Should stay on login page
    await expect(page).toHaveURL(/\/login/);

    // Error banner should be visible
    await expect(page.getByRole("alert")).toBeVisible();
  });

  test("redirects to intended page after login", async ({ page }) => {
    await mockApi(page);
    await page.goto("/devices");

    // Should be redirected to login with returnUrl
    await expect(page).toHaveURL(/\/login/);

    // Login
    await page.getByLabel(/username/i).fill(VALID_CREDENTIALS.username);
    await page.getByLabel(/password/i).fill(VALID_CREDENTIALS.password);
    await page.getByRole("button", { name: /sign in/i }).click();

    // Should redirect back to /devices, not dashboard
    await expect(page).toHaveURL(/\/devices/);
  });

  test("clears auth on 401 from API", async ({ page }) => {
    await mockApi(page);

    // Login first to set the token
    await page.goto("/login");
    await page.getByLabel(/username/i).fill(VALID_CREDENTIALS.username);
    await page.getByLabel(/password/i).fill(VALID_CREDENTIALS.password);
    await page.getByRole("button", { name: /sign in/i }).click();
    await expect(page).not.toHaveURL(/\/login/);

    // Override the dashboard route to return 401
    await page.route("**/api/dashboard/today", (route) =>
      route.fulfill({
        status: 401,
        contentType: "application/json",
        body: JSON.stringify({ error: "Token expired" }),
      }),
    );

    // Navigate to dashboard — should trigger 401 → redirect to login
    await page.goto("/dashboard");

    // Should be redirected to login
    await expect(page).toHaveURL(/\/login/);

    // Token should be cleared
    const token = await page.evaluate(() => localStorage.getItem("authToken"));
    expect(token).toBeNull();
  });
});

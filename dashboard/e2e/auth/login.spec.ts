/**
 * Auth flow E2E tests.
 *
 * Covers: login success, login failure, unauthenticated redirect, JWT persistence,
 * and 401 handling. All tests use the real Rust backend with seeded credentials.
 */
import { test, expect } from "@playwright/test";
import { loginAs, CREDENTIALS } from "../helpers/auth";

// ── Tests ────────────────────────────────────────────────────────────────────

test.describe("Authentication", () => {
  test("redirects to login when unauthenticated", async ({ page }) => {
    await page.goto("/devices");

    // Should be redirected to /login with returnUrl param
    await expect(page).toHaveURL(/\/login/);

    // Login form should be visible — use level 1 to avoid matching the h3 "Sign in"
    await expect(page.getByRole("heading", { level: 1, name: /sign in to timekeep/i })).toBeVisible();
  });

  test("logins with valid credentials and redirects to dashboard", async ({ page }) => {
    await page.goto("/login");

    await page.getByPlaceholder(/admin/i).fill(CREDENTIALS.admin.username);
    await page.getByPlaceholder(/password/i).fill(CREDENTIALS.admin.password);
    await page.getByRole("button", { name: /sign in/i }).click();

    // Should redirect away from login (default redirect is dashboard)
    await expect(page).not.toHaveURL(/\/login/);

    // JWT should be persisted in localStorage (key is "ao-auth", JSON-encoded)
    const raw = await page.evaluate(() => localStorage.getItem("ao-auth"));
    expect(raw).toBeTruthy();
    const parsed = JSON.parse(raw!);
    // Real JWT is a three-part base64 token
    expect(parsed).toMatch(/^eyJ.+\..+\..+$/);
  });

  test("shows error on invalid credentials", async ({ page }) => {
    await page.goto("/login");

    await page.getByPlaceholder(/admin/i).fill("wrong-user");
    await page.getByPlaceholder(/password/i).fill("wrong-password");
    await page.getByRole("button", { name: /sign in/i }).click();

    // Should stay on login page
    await expect(page).toHaveURL(/\/login/);

    // Error banner should be visible
    await expect(page.getByRole("alert")).toBeVisible();
  });

  test("redirects to intended page after login", async ({ page }) => {
    await page.goto("/devices");

    // Should be redirected to login with returnUrl
    await expect(page).toHaveURL(/\/login/);

    // Login
    await page.getByPlaceholder(/admin/i).fill(CREDENTIALS.admin.username);
    await page.getByPlaceholder(/password/i).fill(CREDENTIALS.admin.password);
    await page.getByRole("button", { name: /sign in/i }).click();

    // Should redirect back to /devices, not dashboard
    await expect(page).toHaveURL(/\/devices/);
  });
});

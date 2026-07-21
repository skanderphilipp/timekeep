/**
 * Shared E2E helpers for real-backend tests.
 *
 * Uses the seeded E2E database credentials — no API mocking.
 * All requests go through the Vite dev proxy → real Rust backend.
 *
 * Usage:
 *   import { loginAs } from "../helpers/auth";
 *   test("HR dashboard", async ({ page }) => {
 *     await loginAs(page, "operator");
 *     // ... test assertions against real backend
 *   });
 */
import { type Page, expect } from "@playwright/test";

// ═══════════════════════════════════════════════════════════════════
// Credentials — match the seed-e2e Makefile target
// ═══════════════════════════════════════════════════════════════════

export type Role = "admin" | "operator" | "viewer";

export const CREDENTIALS: Record<Role, { username: string; password: string }> = {
  admin:    { username: "admin",    password: "admin123" },
  operator: { username: "operator", password: "operator123" },
  viewer:   { username: "viewer",   password: "viewer123" },
};

// ═══════════════════════════════════════════════════════════════════
// Login helper
// ═══════════════════════════════════════════════════════════════════

/**
 * Perform a real login against the Rust backend.
 *
 * Navigates to /login, fills credentials, submits, and waits for
 * redirect to the dashboard. Throws if an error banner appears.
 */
export async function loginAs(
  page: Page,
  role: Role,
): Promise<void> {
  const creds = CREDENTIALS[role];

  await page.goto("/login");

  // Wait for the login form to be rendered
  await page.getByPlaceholder(/admin/i).waitFor({ state: "visible", timeout: 5000 });

  await page.getByPlaceholder(/admin/i).fill(creds.username);
  await page.getByPlaceholder(/password/i).fill(creds.password);
  await page.getByRole("button", { name: /sign in/i }).click();

  // Wait for navigation away from /login (success) or error banner (failure)
  try {
    await page.waitForURL((url) => !url.pathname.includes("/login"), { timeout: 15000 });
  } catch {
    // Check if an error banner appeared
    const errorBanner = page.locator('[role="alert"]');
    if (await errorBanner.isVisible({ timeout: 1000 }).catch(() => false)) {
      const errorText = await errorBanner.textContent();
      throw new Error(`Login failed for role ${role}: ${errorText}`);
    }
    throw new Error(`Login timed out for role ${role} — stayed on /login page`);
  }

  await page.waitForTimeout(500); // let React finish hydration
}

/**
 * Role-Based Access Control — WF-CC-02
 *
 * User Story: As a system administrator, I want each role (admin, operator,
 * viewer) to have exactly the permissions they need so that data is secure
 * and users are not confused by inaccessible features.
 *
 * Acceptance Criteria:
 *   1. Admin can access all pages and perform all actions
 *   2. Operator CAN edit punches and employees; CANNOT manage devices, settings, or users
 *   3. Viewer has read-only access; CANNOT edit anything
 *   4. Direct URL access to forbidden pages returns appropriate error
 */
import { test, expect } from "@playwright/test";
import { loginAs } from "../helpers/auth";

// ═══════════════════════════════════════════════════════════════════
// Role × Route matrix — which roles can access which routes
// ═══════════════════════════════════════════════════════════════════

const ROUTE_ACCESS = {
  "/":                 { admin: true, operator: true,  viewer: true },
  "/employees":        { admin: true, operator: true,  viewer: true },
  "/attendance":       { admin: true, operator: true,  viewer: true },
  "/reports":          { admin: true, operator: true,  viewer: true },
  "/departments":      { admin: true, operator: true,  viewer: false },
  "/devices":          { admin: true, operator: false, viewer: false },
  "/settings":         { admin: true, operator: false, viewer: false },
  "/settings/users":   { admin: true, operator: false, viewer: false },
  "/settings/api-keys":{ admin: true, operator: false, viewer: false },
  "/settings/audit":   { admin: true, operator: false, viewer: false },
} as const;

type Role = "admin" | "operator" | "viewer";
type Route = keyof typeof ROUTE_ACCESS;

// ═══════════════════════════════════════════════════════════════════
// Tests
// ═══════════════════════════════════════════════════════════════════

test.describe("RBAC — Role-Based Access Control (WF-CC-02)", () => {
  for (const role of ["admin", "operator", "viewer"] as Role[]) {
    for (const [route, access] of Object.entries(ROUTE_ACCESS) as [Route, Record<Role, boolean>][]) {
      const shouldAccess = access[role];
      test(`${role} ${shouldAccess ? "CAN" : "CANNOT"} access ${route}`, async ({ page }) => {
        await loginAs(page, role);

        await page.goto(route);
        await page.waitForTimeout(1000);

        if (shouldAccess) {
          // Should be on the expected route (no redirect away)
          const url = page.url();
          const path = new URL(url).pathname;
          expect(path).toBe(route);
        } else {
          // Should be redirected or show an error state
          const url = page.url();
          const path = new URL(url).pathname;

          // Either redirected to dashboard or showing a forbidden state
          const isRedirected = path === "/" || path === "/dashboard";
          const isForbidden = page.getByText(/forbidden/i).or(page.getByText(/access denied/i));
          const forbiddenVisible = await isForbidden.isVisible().catch(() => false);

          expect(isRedirected || forbiddenVisible).toBe(true);
        }
      });
    }
  }
});

import { renderHook } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { I18nProvider } from "@lingui/react";
import { i18n } from "@lingui/core";
import { describe, it, expect } from "vitest";
import type { ReactNode } from "react";

import {
  useBreadcrumbs,
  type BreadcrumbSegment,
} from "@/infrastructure/navigation/use-breadcrumbs";

// ── Wrapper ────────────────────────────────────────────────────────────────────

/**
 * Creates a wrapper component that provides the router and i18n context
 * required by `useBreadcrumbs` (`useLocation` + `useLingui`).
 */
function createWrapper(route: string) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <I18nProvider i18n={i18n}>
        <MemoryRouter initialEntries={[route]}>{children}</MemoryRouter>
      </I18nProvider>
    );
  };
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function renderBreadcrumbs(
  route: string,
  options?: { dynamicLabel?: string },
): BreadcrumbSegment[] {
  const { result } = renderHook(() => useBreadcrumbs(options), {
    wrapper: createWrapper(route),
  });
  return result.current;
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe("useBreadcrumbs", () => {
  describe("root path", () => {
    it("returns empty array for '/'", () => {
      expect(renderBreadcrumbs("/")).toEqual([]);
    });
  });

  describe("simple paths", () => {
    it('derives single segment from "/devices"', () => {
      expect(renderBreadcrumbs("/devices")).toEqual([
        { label: "Devices", path: "/devices" },
      ]);
    });

    it('derives single segment from "/employees"', () => {
      expect(renderBreadcrumbs("/employees")).toEqual([
        { label: "Employees", path: "/employees" },
      ]);
    });

    it('derives single segment from "/punches"', () => {
      expect(renderBreadcrumbs("/punches")).toEqual([
        { label: "Punch Records", path: "/punches" },
      ]);
    });

    it('derives single segment from "/reports"', () => {
      expect(renderBreadcrumbs("/reports")).toEqual([
        { label: "Reports", path: "/reports" },
      ]);
    });

    it('derives single segment from "/settings"', () => {
      expect(renderBreadcrumbs("/settings")).toEqual([
        { label: "Settings", path: "/settings" },
      ]);
    });

    it('derives single segment from "/users"', () => {
      expect(renderBreadcrumbs("/users")).toEqual([
        { label: "Users", path: "/users" },
      ]);
    });

    it('derives single segment from "/dashboard"', () => {
      expect(renderBreadcrumbs("/dashboard")).toEqual([
        { label: "Dashboard", path: "/dashboard" },
      ]);
    });
  });

  describe("nested paths", () => {
    it('derives two segments from "/settings/api-keys"', () => {
      expect(renderBreadcrumbs("/settings/api-keys")).toEqual([
        { label: "Settings", path: "/settings" },
        { label: "API Keys", path: "/settings/api-keys" },
      ]);
    });

    it('derives two segments from "/settings/users"', () => {
      expect(renderBreadcrumbs("/settings/users")).toEqual([
        { label: "Settings", path: "/settings" },
        { label: "Users", path: "/settings/users" },
      ]);
    });

    it('derives two segments from "/settings/endpoints"', () => {
      expect(renderBreadcrumbs("/settings/endpoints")).toEqual([
        { label: "Settings", path: "/settings" },
        { label: "Endpoints", path: "/settings/endpoints" },
      ]);
    });

    it('derives two segments from "/settings/audit"', () => {
      expect(renderBreadcrumbs("/settings/audit")).toEqual([
        { label: "Settings", path: "/settings" },
        { label: "Audit Log", path: "/settings/audit" },
      ]);
    });

    it('derives three segments from "/devices/abc/edit"', () => {
      expect(renderBreadcrumbs("/devices/abc/edit")).toEqual([
        { label: "Devices", path: "/devices" },
        { label: "abc", path: "/devices/abc" },
        { label: "Edit", path: "/devices/abc/edit" },
      ]);
    });
  });

  describe("detail paths (unknown segment)", () => {
    it("falls through with raw segment for unknown path parts", () => {
      expect(renderBreadcrumbs("/employees/abc123")).toEqual([
        { label: "Employees", path: "/employees" },
        { label: "abc123", path: "/employees/abc123" },
      ]);
    });

    it("falls through with raw text for completely unknown segments", () => {
      expect(renderBreadcrumbs("/foo/bar")).toEqual([
        { label: "foo", path: "/foo" },
        { label: "bar", path: "/foo/bar" },
      ]);
    });
  });

  describe("dynamicLabel option", () => {
    it("overrides the last segment label when provided", () => {
      expect(
        renderBreadcrumbs("/employees/abc123", { dynamicLabel: "John Doe" }),
      ).toEqual([
        { label: "Employees", path: "/employees" },
        { label: "John Doe", path: "/employees/abc123" },
      ]);
    });

    it("does not affect non-last segments", () => {
      expect(
        renderBreadcrumbs("/settings/api-keys", { dynamicLabel: "Custom" }),
      ).toEqual([
        { label: "Settings", path: "/settings" },
        { label: "Custom", path: "/settings/api-keys" },
      ]);
    });

    it("works with a single segment", () => {
      expect(
        renderBreadcrumbs("/employees/abc123/edit", {
          dynamicLabel: "Custom Action",
        }),
      ).toEqual([
        { label: "Employees", path: "/employees" },
        { label: "abc123", path: "/employees/abc123" },
        { label: "Custom Action", path: "/employees/abc123/edit" },
      ]);
    });
  });

  describe("known segment labels", () => {
    it('maps "new" to "New"', () => {
      expect(renderBreadcrumbs("/employees/new")).toEqual([
        { label: "Employees", path: "/employees" },
        { label: "New", path: "/employees/new" },
      ]);
    });

    it('maps "edit" to "Edit"', () => {
      expect(renderBreadcrumbs("/employees/123/edit")).toEqual([
        { label: "Employees", path: "/employees" },
        { label: "123", path: "/employees/123" },
        { label: "Edit", path: "/employees/123/edit" },
      ]);
    });
  });

  describe("path accumulation", () => {
    it("accumulates paths correctly for each segment", () => {
      const segments = renderBreadcrumbs("/a/b/c");
      expect(segments.map((s) => s.path)).toEqual(["/a", "/a/b", "/a/b/c"]);
    });
  });
});

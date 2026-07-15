/**
 * Breadcrumbs hook — derives breadcrumb trail from the current route.
 *
 * Pure route-to-label mapping. No business logic beyond translating
 * URL segments into human-readable labels.
 *
 * Pages that need a dynamic label for the last segment (e.g., record
 * detail pages showing the employee name) can pass `dynamicLabel`.
 */

import { useMemo } from "react";
import { useLocation } from "react-router-dom";
import { useLingui } from "@lingui/react";
import { msg } from "@lingui/core/macro";

export type BreadcrumbSegment = {
  label: string;
  path: string;
};

export type UseBreadcrumbsOptions = {
  /**
   * Override the label for the last breadcrumb segment.
   * Use for record detail pages where the URL segment is an ID,
   * but the breadcrumb should show the record name.
   *
   * @example
   * // "/employees/abc123" with dynamicLabel="John Doe"
   * // → [{ label: "Employees", path: "/employees" },
   * //    { label: "John Doe", path: "/employees/abc123" }]
   */
  dynamicLabel?: string;
};

/**
 * Returns breadcrumb segments for the current location.
 *
 * @example
 * ```tsx
 * const breadcrumbs = useBreadcrumbs();
 * // "/devices/CQZ123/edit" → [
 * //   { label: "Devices", path: "/devices" },
 * //   { label: "CQZ123", path: "/devices/CQZ123" },
 * //   { label: "Edit", path: "/devices/CQZ123/edit" },
 * // ]
 * ```
 */
export function useBreadcrumbs(options?: UseBreadcrumbsOptions): BreadcrumbSegment[] {
  const location = useLocation();
  const { _ } = useLingui();

  return useMemo(() => {
    if (location.pathname === "/") return [];

    const segments = location.pathname.split("/").filter(Boolean);

    const labelMap: Record<string, string> = {
      dashboard: _(msg`Dashboard`),
      devices: _(msg`Devices`),
      employees: _(msg`Employees`),
      punches: _(msg`Punch Records`),
      reports: _(msg`Reports`),
      settings: _(msg`Settings`),
      users: _(msg`Users`),
      endpoints: _(msg`Endpoints`),
      "api-keys": _(msg`API Keys`),
      audit: _(msg`Audit Log`),
      new: _(msg`New`),
      edit: _(msg`Edit`),
    };

    return segments.map((segment, index) => {
      const path = "/" + segments.slice(0, index + 1).join("/");
      const isLast = index === segments.length - 1;

      return {
        label:
          isLast && options?.dynamicLabel
            ? options.dynamicLabel
            : (labelMap[segment] ?? segment),
        path,
      };
    });
  }, [location.pathname, _, options?.dynamicLabel]);
}

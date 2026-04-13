/**
 * Breadcrumbs hook — derives breadcrumb trail from the current route.
 *
 * Pure route-to-label mapping. No business logic beyond translating
 * URL segments into human-readable labels.
 */

import { useMemo } from "react";
import { useLocation } from "react-router-dom";
import { useLingui } from "@lingui/react";

export type BreadcrumbSegment = {
  label: string;
  path: string;
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
export function useBreadcrumbs(): BreadcrumbSegment[] {
  const location = useLocation();
  const { _ } = useLingui();

  return useMemo(() => {
    if (location.pathname === "/") return [];

    const segments = location.pathname.split("/").filter(Boolean);

    const labelMap: Record<string, string> = {
      devices: _(/*i18n*/ { id: "breadcrumb.devices", message: "Devices" }),
      punches: _(/*i18n*/ { id: "breadcrumb.punches", message: "Punch Records" }),
      reports: _(/*i18n*/ { id: "breadcrumb.reports", message: "Reports" }),
      settings: _(/*i18n*/ { id: "breadcrumb.settings", message: "Settings" }),
      users: _(/*i18n*/ { id: "breadcrumb.users", message: "Users" }),
      endpoints: _(/*i18n*/ { id: "breadcrumb.endpoints", message: "Endpoints" }),
      "api-keys": _(/*i18n*/ { id: "breadcrumb.apiKeys", message: "API Keys" }),
      audit: _(/*i18n*/ { id: "breadcrumb.audit", message: "Audit Log" }),
      new: _(/*i18n*/ { id: "breadcrumb.new", message: "New" }),
      edit: _(/*i18n*/ { id: "breadcrumb.edit", message: "Edit" }),
    };

    return segments.map((segment, index) => {
      const path = "/" + segments.slice(0, index + 1).join("/");
      return {
        label: labelMap[segment] ?? segment,
        path,
      };
    });
  }, [location.pathname, _]);
}

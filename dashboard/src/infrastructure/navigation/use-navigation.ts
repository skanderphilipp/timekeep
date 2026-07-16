/**
 * Navigation hook — resolves nav items with i18n labels and role filtering.
 *
 * Consumes the pure-data `NAVIGATION_ITEMS` from `shared/navigation.json`
 * and enriches it with React-specific concerns: Lingui translation,
 * Tabler icon resolution, and Jotai-based role filtering.
 */

import { useMemo } from "react";
import { useLingui } from "@lingui/react";
import {
  IconDashboard,
  IconDevices,
  IconFingerprint,
  IconReport,
  IconSettings,
  IconUsers,
  IconBuilding,
  IconClock,
  type Icon,
} from "@tabler/icons-react";

import { currentUserRoleSelector } from "@/infrastructure/state";
import { useStateValue } from "@/infrastructure/state/jotai";
import { NAVIGATION_ITEMS, type NavigationItem } from "./navigation-model";
import { roleSatisfies } from "./roles";

/** Resolved nav item ready for rendering in the sidebar. */
export type ResolvedNavItem = {
  /** Unique key. */
  key: string;
  /** Translated display label (a function that returns a string). */
  label: () => string;
  /** React Router path (undefined for parent-only items). */
  path?: string;
  /** Resolved Tabler icon component (undefined for child items). */
  icon?: Icon;
  /** Whether to use exact path matching. */
  end: boolean;
  /** Nested sub-items (undefined for leaf items). */
  children?: ResolvedNavItem[];
  /** Minimum role required. */
  minRole?: string;
};

/** Maps icon name strings from the model to actual Tabler components. */
const ICON_MAP: Record<string, Icon> = {
  IconDashboard,
  IconDevices,
  IconFingerprint,
  IconReport,
  IconSettings,
  IconUsers,
  IconBuilding,
  IconClock,
};

/**
 * Returns the resolved navigation tree filtered by the current user's role.
 *
 * Parent items with children are included if at least one child survives
 * the role filter. Items with `minRole` are excluded if the user's role
 * is insufficient.
 */
export function useNavigation(): ResolvedNavItem[] {
  const { _ } = useLingui();
  const role = useStateValue(currentUserRoleSelector);

  return useMemo(() => {
    const labelMap: Record<string, () => string> = {
      "nav.dashboard": () => _(/*i18n*/ { id: "nav.dashboard", message: "Dashboard" }),
      "nav.devices": () => _(/*i18n*/ { id: "nav.devices", message: "Devices" }),
      "nav.devices.list": () => _(/*i18n*/ { id: "nav.devices.list", message: "All Devices" }),
      "nav.punches": () => _(/*i18n*/ { id: "nav.punches", message: "Punches" }),
      "nav.employees": () => _(/*i18n*/ { id: "nav.employees", message: "Employees" }),
      "nav.reports": () => _(/*i18n*/ { id: "nav.reports", message: "Reports" }),
      "nav.departments": () => _(/*i18n*/ { id: "nav.departments", message: "Departments" }),
      "nav.workPolicies": () => _(/*i18n*/ { id: "nav.workPolicies", message: "Work Policies" }),
      "nav.devices.groups": () => _(/*i18n*/ { id: "nav.devices.groups", message: "Device Groups" }),
      "nav.settings": () => _(/*i18n*/ { id: "nav.settings", message: "Settings" }),
      "nav.settings.system": () => _(/*i18n*/ { id: "nav.settings.system", message: "System" }),
      "nav.settings.users": () => _(/*i18n*/ { id: "nav.settings.users", message: "Users" }),
      "nav.settings.apiKeys": () => _(/*i18n*/ { id: "nav.settings.apiKeys", message: "API Keys" }),
      "nav.settings.endpoints": () =>
        _(/*i18n*/ { id: "nav.settings.endpoints", message: "Endpoints" }),
      "nav.settings.audit": () => _(/*i18n*/ { id: "nav.settings.audit", message: "Audit Log" }),
    };

    function resolveItem(item: NavigationItem): ResolvedNavItem | null {
      // Check role access
      if (item.minRole && role && !roleSatisfies(role, item.minRole)) {
        return null;
      }

      // Resolve children recursively
      const resolvedChildren = item.children
        ?.map(resolveItem)
        .filter((c): c is ResolvedNavItem => c !== null);

      // If this is a parent with children but all children were filtered out, hide it
      if (item.children && !item.path && (!resolvedChildren || resolvedChildren.length === 0)) {
        return null;
      }

      return {
        key: item.key,
        label: labelMap[item.labelKey] ?? (() => item.labelKey),
        path: item.path,
        icon: item.iconName ? ICON_MAP[item.iconName] : undefined,
        end: item.end ?? false,
        children: resolvedChildren && resolvedChildren.length > 0 ? resolvedChildren : undefined,
        minRole: item.minRole,
      };
    }

    return NAVIGATION_ITEMS.map(resolveItem).filter(
      (item): item is ResolvedNavItem => item !== null,
    );
  }, [_, role]);
}

/**
 * Navigation tree — single source of truth for the sidebar and routing.
 *
 * To add a new page:
 * 1. Add an entry to `NAVIGATION_ITEMS` below
 * 2. Create the page component in `modules/{name}/pages/`
 * 3. Register the route in `App.tsx`
 *
 * Framework-agnostic: no React, no Jotai, no router imports.
 */

import type { Role } from "./roles";

/**
 * A single entry in the sidebar navigation tree.
 *
 * Top-level items require `iconName` and render as either leaf links
 * or collapsible groups (when `children` is present).
 *
 * Child items omit `iconName` — they inherit the parent's visual context.
 */
export type NavigationItem = {
  /** Unique key (used as React key and for route identification). */
  key: string;
  /** Lingui msg ID resolved at render time by the i18n system. */
  labelKey: string;
  /** Tabler icon component name. Required for top-level items, omitted for children. */
  iconName?: string;
  /** React Router path. Omit for parent-only items (no direct navigation). */
  path?: string;
  /** Nested sub-items. When present, renders as a collapsible group. */
  children?: NavigationItem[];
  /** Minimum role required to see this item. Omit for all authenticated users. */
  minRole?: Role;
  /**
   * Whether to use React Router's `end` prop for exact matching.
   * Set `true` for the root "/" route to avoid matching every path.
   */
  end?: boolean;
};

/**
 * The canonical navigation tree.
 *
 * Order here determines sidebar order.
 * Role filtering is applied at render time by `useNavigation`.
 */
export const NAVIGATION_ITEMS: NavigationItem[] = [
  {
    key: "dashboard",
    labelKey: "nav.dashboard",
    path: "/",
    iconName: "IconDashboard",
    end: true,
  },
  {
    key: "devices",
    labelKey: "nav.devices",
    iconName: "IconDevices",
    children: [
      {
        key: "devices.list",
        labelKey: "nav.devices.list",
        path: "/devices",
      },
    ],
  },
  {
    key: "punches",
    labelKey: "nav.punches",
    path: "/punches",
    iconName: "IconFingerprint",
  },
  {
    key: "reports",
    labelKey: "nav.reports",
    path: "/reports",
    iconName: "IconReport",
  },
  {
    key: "settings",
    labelKey: "nav.settings",
    iconName: "IconSettings",
    children: [
      {
        key: "settings.system",
        labelKey: "nav.settings.system",
        path: "/settings",
      },
      {
        key: "settings.users",
        labelKey: "nav.settings.users",
        path: "/settings/users",
      },
      {
        key: "settings.apiKeys",
        labelKey: "nav.settings.apiKeys",
        path: "/settings/api-keys",
      },
      {
        key: "settings.endpoints",
        labelKey: "nav.settings.endpoints",
        path: "/settings/endpoints",
      },
      {
        key: "settings.audit",
        labelKey: "nav.settings.audit",
        path: "/settings/audit",
      },
    ],
  },
];

/**
 * Flattens the navigation tree into depth-first list,
 * preserving parent-child relationship metadata.
 * Useful for breadcrumb resolution and route matching.
 */
export type FlatNavItem = NavigationItem & { parentKey?: string; depth: number };

export function flattenNavigation(
  items: readonly NavigationItem[],
  depth = 0,
  parentKey?: string,
): FlatNavItem[] {
  const result: FlatNavItem[] = [];
  for (const item of items) {
    if (item.path) {
      result.push({ ...item, depth, parentKey });
    }
    if (item.children) {
      result.push(...flattenNavigation(item.children, depth + 1, item.key));
    }
  }
  return result;
}

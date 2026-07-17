import { useMemo } from "react";
import { useLocation, matchPath } from "react-router-dom";
import type { PageId } from "./command-types";

// ── Route → PageId mapping ─────────────────────────────────────────────────────

/**
 * Maps route patterns to page identifiers.
 *
 * When the current URL matches one of these patterns, commands scoped
 * to that page (or pattern) become visible. Patterns use React Router's
 * `:param` syntax for dynamic segments.
 */
const ROUTE_TO_PAGE: Array<{ pattern: string; pageId: PageId }> = [
  { pattern: "/", pageId: "dashboard" },
  { pattern: "/devices", pageId: "devices.list" },
  { pattern: "/devices/new", pageId: "devices.new" },
  { pattern: "/devices/:sn", pageId: "devices.detail" },
  { pattern: "/attendance", pageId: "attendance.list" },
  { pattern: "/employees", pageId: "employees.list" },
  { pattern: "/employees/new", pageId: "employees.new" },
  { pattern: "/employees/:id", pageId: "employees.detail" },
  { pattern: "/reports", pageId: "reports" },
  { pattern: "/settings", pageId: "settings.system" },
  { pattern: "/settings/users", pageId: "settings.users" },
  { pattern: "/settings/api-keys", pageId: "settings.apiKeys" },
  { pattern: "/settings/endpoints", pageId: "settings.endpoints" },
  { pattern: "/settings/audit", pageId: "settings.audit" },
];

// ── Pattern matching ───────────────────────────────────────────────────────────

/**
 * Returns true if the current path matches any pattern starting with `prefix`.
 *
 * Useful for pattern-scoped commands like "all device pages".
 */
function pathMatchesPatternPrefix(pathname: string, prefix: string): boolean {
  return pathname.startsWith(prefix) || pathname === prefix;
}

// ── Hook ───────────────────────────────────────────────────────────────────────

export type PageContext = {
  /** The resolved page identifier, or null if on a non-mapped page (e.g. login). */
  pageId: PageId | null;
  /** The current URL pathname. */
  pathname: string;
  /** Check if the current path matches a prefix (for pattern-scoped commands). */
  matchesPrefix: (prefix: string) => boolean;
};

/**
 * Detects the current page context from the router.
 *
 * Used by `useCommands()` to resolve which contextual commands should
 * be visible, and by `SidePanelCmdk` to group commands by context.
 */
export function usePageContext(): PageContext {
  const location = useLocation();
  const pathname = location.pathname;

  const pageId = useMemo<PageId | null>(() => {
    for (const entry of ROUTE_TO_PAGE) {
      if (matchPath(entry.pattern, pathname)) {
        return entry.pageId;
      }
    }
    return null;
  }, [pathname]);

  const matchesPrefix = useMemo(
    () => (prefix: string) => pathMatchesPatternPrefix(pathname, prefix),
    [pathname],
  );

  return { pageId, pathname, matchesPrefix };
}

/**
 * Navigation model — thin re-export from `shared/navigation.ts`.
 *
 * The canonical navigation tree lives in `shared/` so it can be consumed
 * by any frontend (this dashboard, a mobile app, a docs site).
 */

export {
  NAVIGATION_ITEMS,
  flattenNavigation,
  type NavigationItem,
  type FlatNavItem,
} from "@shared/navigation";

/**
 * Navigation infrastructure — public API surface.
 *
 * All navigation-related logic lives here:
 * - `roles.ts`      → Pure role hierarchy functions (framework-agnostic)
 * - `navigation-model.ts` → Nav items as pure data (framework-agnostic)
 * - `use-navigation.ts`   → React hook: resolves icons, labels, role filtering
 * - `use-breadcrumbs.ts`  → React hook: derives breadcrumb trail
 */

export { roleSatisfies, roleLevel, type Role, ROLES } from "./roles";
export { NAVIGATION_ITEMS, type NavigationItem } from "./navigation-model";
export { useNavigation, type ResolvedNavItem } from "./use-navigation";
export { useBreadcrumbs, type BreadcrumbSegment } from "./use-breadcrumbs";

import { useMediaQuery } from "react-responsive";

import { MOBILE_VIEWPORT } from "@/lib/constants";

/**
 * Returns true when the viewport is at or below the mobile breakpoint (768px).
 *
 * Uses `react-responsive` for SSR-safe media query matching.
 * Breakpoint value sourced from `MOBILE_VIEWPORT` in `@/lib/constants`.
 */
export function useIsMobile(): boolean {
  return useMediaQuery({ query: `(max-width: ${MOBILE_VIEWPORT}px)` });
}

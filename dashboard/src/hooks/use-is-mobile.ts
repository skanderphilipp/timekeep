import { useMediaQuery } from "react-responsive";

/** Breakpoint value matching the SCSS $breakpoints 'mobile' key. */
const MOBILE_BREAKPOINT = 768;

/**
 * Returns true when the viewport is at or below the mobile breakpoint (768px).
 *
 * Uses `react-responsive` for SSR-safe media query matching.
 */
export function useIsMobile(): boolean {
  return useMediaQuery({ query: `(max-width: ${MOBILE_BREAKPOINT}px)` });
}

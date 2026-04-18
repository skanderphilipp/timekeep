import { useContext } from "react";

import { ThemeContext, type Theme } from "./theme-context";

/**
 * Access the resolved theme tokens.
 *
 * Returns a typed object with all `--ao-*` CSS custom properties resolved
 * to their computed values. Numeric values (spacing, font sizes in px) are
 * returned as numbers; all others as strings.
 *
 * @example
 * ```tsx
 * const theme = useTheme();
 * const primaryBg = theme.background.primary; // "color(display-p3 …)"
 * const spacing4 = theme.spacing["4"];        // "16px"
 * ```
 */
export function useTheme(): Theme {
  return useContext(ThemeContext).theme;
}

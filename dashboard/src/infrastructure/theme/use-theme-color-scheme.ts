import { useContext } from "react";

import { ThemeContext, type ColorScheme } from "./theme-context";

/**
 * Access the current color scheme ("light" | "dark").
 *
 * Use this for conditional rendering based on the active theme,
 * e.g., swapping icon assets or applying colorScheme-dependent logic.
 *
 * @example
 * ```tsx
 * const colorScheme = useThemeColorScheme();
 * const logoSrc = colorScheme === "dark" ? "/logo-dark.svg" : "/logo-light.svg";
 * ```
 */
export function useThemeColorScheme(): ColorScheme {
  return useContext(ThemeContext).colorScheme;
}

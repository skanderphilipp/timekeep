import { createContext, useLayoutEffect, useMemo, useState, type ReactNode } from "react";
import { useAtomValue } from "jotai";

import { themeAtom } from "@/infrastructure/state";
import { themeCssVariables } from "./theme-css-variables";

// ── Types ────────────────────────────────────────────────────────────────────

/**
 * Recursively resolve a `var(--ao-*)` value to its computed result.
 * String leaves are resolved via getComputedStyle; nested objects are recursed.
 */
type ResolvedTokens<T> = {
  [K in keyof T]: T[K] extends string
    ? string
    : T[K] extends Record<string, unknown>
      ? ResolvedTokens<T[K]>
      : T[K];
};

/**
 * Shape of the theme object produced by resolving all CSS custom properties
 * against the document root at runtime.
 */
export type Theme = ResolvedTokens<typeof themeCssVariables>;

/** Light or dark color scheme. */
export type ColorScheme = "light" | "dark";

export type ThemeContextValue = {
  /** Resolved theme tokens (computed from live CSS custom properties). */
  theme: Theme;
  /** Current color scheme. */
  colorScheme: ColorScheme;
};

// ── Context ──────────────────────────────────────────────────────────────────

export const ThemeContext = createContext<ThemeContextValue>({
  theme: themeCssVariables as unknown as Theme,
  colorScheme: "light",
});

// ── Provider ─────────────────────────────────────────────────────────────────

type ThemeProviderProps = {
  children: ReactNode;
};

/**
 * Theme provider that bridges Jotai state and the DOM.
 *
 * Responsibilities:
 * 1. Reads the persisted theme from Jotai's `themeAtom`.
 * 2. Syncs `light` / `dark` class to `<html>` (replaces the ad-hoc
 *    `useThemeSync` hook that previously lived in AppShell).
 * 3. Resolves all `--ao-*` CSS custom properties into a typed JavaScript
 *    object via `getComputedStyle`, making theme values available to
 *    `useTheme()` and `useThemeColorScheme()` consumers.
 *
 * Wrap this around your app root (above AppShell). Jotai atoms remain the
 * single source of truth for persistence; this provider is the bridge layer.
 */
export function ThemeProvider({ children }: ThemeProviderProps) {
  const colorScheme = useAtomValue(themeAtom);

  // ── DOM sync ────────────────────────────────────────────────────────────

  useLayoutEffect(() => {
    const root = document.documentElement;

    // Add transition class so CSS can animate theme changes
    root.classList.add("theme-transitioning");

    root.classList.remove("light", "dark");
    root.classList.add(colorScheme);

    const timeout = setTimeout(() => {
      root.classList.remove("theme-transitioning");
    }, 300);

    return () => clearTimeout(timeout);
  }, [colorScheme]);

  // ── Theme computation ───────────────────────────────────────────────────

  const [theme, setTheme] = useState<Theme>(() => computeTheme());

  useLayoutEffect(() => {
    // Recompute after DOM class is applied so CSS vars are in effect
    // Use a microtask to let the browser paint the class change first
    const frame = requestAnimationFrame(() => {
      setTheme(computeTheme());
    });
    return () => cancelAnimationFrame(frame);
  }, [colorScheme]);

  const value = useMemo<ThemeContextValue>(() => ({ theme, colorScheme }), [theme, colorScheme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Resolve all CSS custom properties from the document root into a
 * typed JavaScript object.
 */
function computeTheme(): Theme {
  if (typeof document === "undefined" || typeof getComputedStyle !== "function") {
    return themeCssVariables as unknown as Theme;
  }

  const style = getComputedStyle(document.documentElement);

  const resolve = (obj: Record<string, unknown>): Record<string, unknown> => {
    const result: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === "string" && value.startsWith("var(")) {
        // Extract variable name from var(--name)
        const varName = value.slice(4, -1);
        const raw = style.getPropertyValue(varName).trim();
        const num = Number(raw);
        // Return numbers as numbers, strings otherwise
        result[key] = raw !== "" && !Number.isNaN(num) ? num : raw;
      } else if (typeof value === "object" && value !== null) {
        result[key] = resolve(value as Record<string, unknown>);
      } else {
        result[key] = value;
      }
    }

    return result;
  };

  return resolve(themeCssVariables as unknown as Record<string, unknown>) as unknown as Theme;
}

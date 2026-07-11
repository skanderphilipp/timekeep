import { useMemo } from "react";

import { useTheme, type Theme } from "@/infrastructure/theme";

import { buildNivoTheme } from "./nivo-theme";

/**
 * Theme bridge for chart components.
 *
 * Returns concrete (d3-parseable) color values resolved from the
 * `--ao-chart-*` tokens, plus a matching Nivo theme. Everything
 * re-resolves when the color scheme flips, so charts follow the theme.
 */
export type ChartTheme = {
  /** Categorical series palette in assignment order. */
  categorical: string[];
  /** Semantic chart roles. */
  semantic: {
    primary: string;
    positive: string;
    negative: string;
    warning: string;
    info: string;
    neutral: string;
  };
  /** Nivo theme object built from resolved tokens. */
  nivo: ReturnType<typeof buildNivoTheme>;
  /**
   * Resolve a color prop for chart data. Accepts a concrete CSS color
   * (returned as-is) or a `var(--ao-*)` / `--ao-*` token reference,
   * which is resolved against the live document so chart libraries
   * receive a real color instead of an unresolvable var() string.
   */
  resolveColor: (color: string) => string;
};

function resolveToken(reference: string): string {
  const token =
    /^var\(\s*(--[\w-]+)\s*\)$/.exec(reference)?.[1] ??
    (reference.startsWith("--") ? reference : null);
  if (!token) return reference;
  if (typeof document === "undefined") return reference;
  const resolved = getComputedStyle(document.documentElement).getPropertyValue(token).trim();
  return resolved === "" ? reference : resolved;
}

export function useChartTheme(): ChartTheme {
  const theme: Theme = useTheme();

  return useMemo(() => {
    const c = theme.chart;
    return {
      categorical: [
        c.categorical[1],
        c.categorical[2],
        c.categorical[3],
        c.categorical[4],
        c.categorical[5],
        c.categorical[6],
      ].map(String),
      semantic: {
        primary: String(c.primary),
        positive: String(c.positive),
        negative: String(c.negative),
        warning: String(c.warning),
        info: String(c.info),
        neutral: String(c.neutral),
      },
      nivo: buildNivoTheme(theme),
      resolveColor: resolveToken,
    };
  }, [theme]);
}

import { describe, it, expect } from "vitest";
import { renderHook } from "@testing-library/react";
import { Provider as JotaiProvider } from "jotai";
import type { ReactNode } from "react";

import { ThemeProvider } from "@/infrastructure/theme/theme-context";
import { useChartTheme } from "./use-chart-theme";

/**
 * jsdom does not process CSS file imports by default. We must manually
 * define the CSS custom properties that computeTheme() resolves via
 * getComputedStyle(). Without this, all --ao-* variables resolve to ""
 * and the chart would render invisible bars.
 *
 * NOTE: Storybook (browser) loads generated-tokens.css via preview.tsx,
 * so this is a test-only concern. The fact that bar fill colors show up
 * as rgba(0,162,199,1) in the user's Storybook HTML means the browser
 * does resolve the tokens correctly.
 */
function injectTokens() {
  const root = document.documentElement;
  root.style.setProperty("--ao-chart-1", "#00a2c7");
  root.style.setProperty("--ao-chart-2", "#0090ff");
  root.style.setProperty("--ao-chart-3", "#30a46c");
  root.style.setProperty("--ao-chart-4", "#ffc53d");
  root.style.setProperty("--ao-chart-5", "#e5484d");
  root.style.setProperty("--ao-chart-6", "#bbbbbb");
  root.style.setProperty("--ao-font-family", "Inter, sans-serif");
  root.style.setProperty("--ao-font-color-primary", "#202020");
  root.style.setProperty("--ao-font-color-secondary", "#646464");
  root.style.setProperty("--ao-font-color-tertiary", "#838383");
  root.style.setProperty("--ao-border-color-light", "#e8e8e8");
  root.style.setProperty("--ao-border-color-medium", "#cecece");
  root.style.setProperty("--ao-background-primary", "#fcfcfc");
  root.style.setProperty("--ao-radius-sm", "4px");
  root.style.setProperty("--ao-shadow-sm", "0 1px 2px rgba(0,0,0,0.05)");
  root.style.setProperty("--ao-chart-primary", "#00a2c7");
  root.style.setProperty("--ao-chart-positive", "#30a46c");
  root.style.setProperty("--ao-chart-negative", "#e5484d");
  root.style.setProperty("--ao-chart-warning", "#ffc53d");
  root.style.setProperty("--ao-chart-info", "#0090ff");
  root.style.setProperty("--ao-chart-neutral", "#bbbbbb");
}

injectTokens();

function Wrapper({ children }: { children: ReactNode }) {
  return (
    <JotaiProvider>
      <ThemeProvider>{children}</ThemeProvider>
    </JotaiProvider>
  );
}

describe("useChartTheme", () => {
  it("returns valid CSS colors for categorical palette (NOT var() refs)", () => {
    const { result } = renderHook(() => useChartTheme(), { wrapper: Wrapper });
    const { categorical, nivo, resolveColor } = result.current;

    console.log("categorical:", JSON.stringify(categorical));
    console.log("nivo.text.fill:", nivo.text.fill);

    for (let i = 0; i < categorical.length; i++) {
      const color = categorical[i];
      expect(color, `categorical[${i}] must not be empty`).not.toBe("");
      expect(color, `categorical[${i}] must not be var() ref`).not.toMatch(/^var\(/);
      expect(color, `categorical[${i}]="${color}" must be a valid color`).toMatch(
        /^(#[0-9a-fA-F]{3,8}|rgb\(|rgba\(|hsl\(|hsla\(|[a-z]+)$/,
      );
    }

    // Nivo theme colors must be parseable (no P3, no var() refs)
    expect(nivo.text.fill).not.toMatch(/^var\(/);
    expect(nivo.text.fill).not.toMatch(/^color\(display-p3/);
    expect(nivo.grid.line.stroke).not.toMatch(/^color\(display-p3/);

    // resolveColor must work
    const resolved = resolveColor("var(--ao-chart-positive)");
    expect(resolved, "resolveColor must return real color").toBe("#30a46c");
  });

  it("returns exactly 6 categorical colors", () => {
    const { result } = renderHook(() => useChartTheme(), { wrapper: Wrapper });
    expect(result.current.categorical).toHaveLength(6);
  });
});

// ── Design Token Generator ───────────────────────────────────────────────
// Generates CSS custom properties from Radix Colors at build time.
// Output: generated-tokens.css (imported by main.tsx)
//
// This file is the ONLY place raw color/size values may exist.
// Everything else in src/ must reference the emitted `--ao-*` tokens.
// `pnpm lint:tokens` enforces both directions:
//   - every var(--ao-*) reference must exist here
//   - generated-tokens.css must be in sync with this file
//
// Strategy: dual-output — hex (sRGB) fallback first, then P3 override.
// Browsers that support color(display-p3 ...) use the wide-gamut values.
// All other browsers fall back to standard sRGB hex values.

import * as RadixColors from "@radix-ui/colors";

// ── Types ─────────────────────────────────────────────────────────────────

export type Theme = "light" | "dark";
export type TokenDef = Record<string, string>;

type ColorScale = Record<number, string>;

// ── Color scales ──────────────────────────────────────────────────────────
// Full 12-step Radix scales. Semantic roles (per Radix guidance):
//   1-2 backgrounds · 3-5 component states · 6-8 borders · 9-10 solid · 11-12 text

const STEPS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const;

function pick(palette: Record<string, string>, prefix: string): ColorScale {
  const scale: ColorScale = {};
  for (const step of STEPS) {
    const value = palette[`${prefix}${step}`];
    if (!value) throw new Error(`Missing Radix color: ${prefix}${step}`);
    scale[step] = value;
  }
  return scale;
}

type ScaleSet = { light: ColorScale; dark: ColorScale };

function radixScale(name: keyof typeof RadixColors & string): ScaleSet {
  const dark = `${name}Dark` as keyof typeof RadixColors;
  return {
    light: pick(RadixColors[name] as Record<string, string>, name),
    dark: pick(RadixColors[dark] as Record<string, string>, name),
  };
}

function radixScaleP3(name: keyof typeof RadixColors & string): ScaleSet {
  const p3 = `${name}P3` as keyof typeof RadixColors;
  const darkP3 = `${name}DarkP3` as keyof typeof RadixColors;
  return {
    light: pick(RadixColors[p3] as Record<string, string>, name),
    dark: pick(RadixColors[darkP3] as Record<string, string>, name),
  };
}

type Palette = {
  gray: ColorScale;
  accent: ColorScale;
  red: ColorScale;
  green: ColorScale;
  amber: ColorScale;
  blue: ColorScale;
};

const srgb = {
  gray: radixScale("gray"),
  accent: radixScale("cyan"),
  red: radixScale("red"),
  green: radixScale("green"),
  amber: radixScale("amber"),
  blue: radixScale("blue"),
};

const p3 = {
  gray: radixScaleP3("gray"),
  accent: radixScaleP3("cyan"),
  red: radixScaleP3("red"),
  green: radixScaleP3("green"),
  amber: radixScaleP3("amber"),
  blue: radixScaleP3("blue"),
};

function paletteFor(source: typeof srgb, theme: Theme): Palette {
  return {
    gray: source.gray[theme],
    accent: source.accent[theme],
    red: source.red[theme],
    green: source.green[theme],
    amber: source.amber[theme],
    blue: source.blue[theme],
  };
}

// ── Token generators ──────────────────────────────────────────────────────

function scaleTokens(prefix: string, scale: ColorScale): TokenDef {
  const tokens: TokenDef = {};
  for (const step of STEPS) tokens[`${prefix}${step}`] = scale[step];
  return tokens;
}

/**
 * Status alias triads. Every status maps onto the same Radix steps so
 * components never reference raw scale steps for status semantics:
 *   bg=3 · bg-hover=4 · border=7 · solid=9 · solid-hover=10 · text=11
 */
function statusTokens(name: string, scale: ColorScale): TokenDef {
  return {
    [`--ao-status-${name}-bg`]: scale[3],
    [`--ao-status-${name}-bg-hover`]: scale[4],
    [`--ao-status-${name}-border`]: scale[7],
    [`--ao-status-${name}-solid`]: scale[9],
    [`--ao-status-${name}-solid-hover`]: scale[10],
    [`--ao-status-${name}-text`]: scale[11],
  };
}

function colorTokens(theme: Theme, c: Palette): TokenDef {
  return {
    // Full scales — any step 1-12 is a valid token.
    ...scaleTokens("--ao-color-gray", c.gray),
    ...scaleTokens("--ao-accent-accent", c.accent),
    ...scaleTokens("--ao-color-red", c.red),
    ...scaleTokens("--ao-color-green", c.green),
    ...scaleTokens("--ao-color-amber", c.amber),
    ...scaleTokens("--ao-color-blue", c.blue),

    // Backgrounds
    "--ao-background-primary": c.gray[1],
    "--ao-background-secondary": c.gray[3],
    "--ao-background-tertiary": c.gray[5],
    "--ao-background-page": c.gray[2],

    // Text
    "--ao-font-color-primary": c.gray[12],
    "--ao-font-color-secondary": c.gray[11],
    "--ao-font-color-tertiary": c.gray[10],
    "--ao-font-color-disabled": c.gray[8],
    // Text placed on solid step-9 backgrounds (buttons, badges).
    "--ao-font-color-inverted": "#ffffff",

    // Borders
    "--ao-border-color-light": c.gray[4],
    "--ao-border-color-medium": c.gray[7],
    "--ao-border-color-strong": c.gray[8],

    // Status aliases
    ...statusTokens("success", c.green),
    ...statusTokens("warning", c.amber),
    ...statusTokens("danger", c.red),
    ...statusTokens("info", c.blue),

    // Interaction
    "--ao-focus-ring": c.accent[8],
    "--ao-overlay": theme === "light" ? "rgba(0, 0, 0, 0.4)" : "rgba(0, 0, 0, 0.6)",

    // Elevation (theme-dependent: dark themes need stronger shadows)
    "--ao-shadow-sm":
      theme === "light" ? "0 1px 2px rgba(0, 0, 0, 0.06)" : "0 1px 2px rgba(0, 0, 0, 0.3)",
    "--ao-shadow-md":
      theme === "light" ? "0 4px 6px rgba(0, 0, 0, 0.07)" : "0 4px 6px rgba(0, 0, 0, 0.35)",
    "--ao-shadow-lg":
      theme === "light"
        ? "0 10px 15px -3px rgba(0, 0, 0, 0.08), 0 4px 6px -4px rgba(0, 0, 0, 0.05)"
        : "0 10px 15px -3px rgba(0, 0, 0, 0.45), 0 4px 6px -4px rgba(0, 0, 0, 0.35)",
    // Page card: subtle left shadow toward the sidebar + 1px border ring.
    "--ao-shadow-page":
      theme === "light"
        ? "-4px 0 4px 0 rgba(0, 0, 0, 0.006), 0 0 0 1px var(--ao-border-color-medium)"
        : "-4px 0 4px 0 rgba(0, 0, 0, 0.03), 0 0 0 1px var(--ao-border-color-medium)",
  };
}

/**
 * Chart palette tokens. Emitted as sRGB hex ONLY (no P3 override):
 * chart libraries (nivo/d3-color) parse these values in JavaScript, and
 * d3-color cannot parse `color(display-p3 …)` strings. Resolving one of
 * these tokens via getComputedStyle always yields a parseable color.
 */
function chartTokens(c: Palette): TokenDef {
  return {
    // Categorical series palette, in assignment order.
    "--ao-chart-1": c.accent[9],
    "--ao-chart-2": c.blue[9],
    "--ao-chart-3": c.green[9],
    "--ao-chart-4": c.amber[9],
    "--ao-chart-5": c.red[9],
    "--ao-chart-6": c.gray[8],
    // Semantic chart roles.
    "--ao-chart-primary": c.accent[9],
    "--ao-chart-positive": c.green[9],
    "--ao-chart-negative": c.red[9],
    "--ao-chart-warning": c.amber[9],
    "--ao-chart-info": c.blue[9],
    "--ao-chart-neutral": c.gray[8],
  };
}

function staticTokens(): TokenDef {
  return {
    "--ao-font-family": '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    "--ao-font-family-mono": '"JetBrains Mono", "Fira Code", monospace',
    "--ao-font-size-xxs": "0.625rem",
    "--ao-font-size-xs": "0.75rem",
    "--ao-font-size-sm": "0.875rem",
    "--ao-font-size-md": "1rem",
    "--ao-font-size-lg": "1.125rem",
    "--ao-font-size-xl": "1.25rem",
    "--ao-font-size-2xl": "1.5rem",
    "--ao-font-size-3xl": "1.875rem",
    "--ao-font-weight-regular": "400",
    "--ao-font-weight-medium": "500",
    "--ao-font-weight-semibold": "600",
    "--ao-font-weight-bold": "700",
    "--ao-line-height-heading": "1.25",
    "--ao-line-height-body": "1.5",
    "--ao-line-height-relaxed": "1.7",
    "--ao-radius-xs": "2px",
    "--ao-radius-sm": "4px",
    "--ao-radius-md": "8px",
    "--ao-radius-lg": "12px",
    "--ao-radius-xl": "16px",
    "--ao-radius-pill": "999px",
    "--ao-radius-full": "100%",
    "--ao-spacing-0": "0px",
    "--ao-spacing-0_5": "2px",
    "--ao-spacing-1": "4px",
    "--ao-spacing-1_5": "6px",
    "--ao-spacing-2": "8px",
    "--ao-spacing-3": "12px",
    "--ao-spacing-4": "16px",
    "--ao-spacing-5": "20px",
    "--ao-spacing-6": "24px",
    "--ao-spacing-7": "28px",
    "--ao-spacing-8": "32px",
    "--ao-spacing-9": "36px",
    "--ao-spacing-10": "40px",
    "--ao-spacing-11": "44px",
    "--ao-spacing-12": "48px",
    "--ao-spacing-13": "52px",
    "--ao-spacing-14": "56px",
    "--ao-spacing-15": "60px",
    "--ao-spacing-16": "64px",
    "--ao-spacing-17": "68px",
    "--ao-spacing-18": "72px",
    "--ao-spacing-19": "76px",
    "--ao-spacing-20": "80px",
    "--ao-spacing-21": "84px",
    "--ao-spacing-22": "88px",
    "--ao-spacing-23": "92px",
    "--ao-spacing-24": "96px",
    "--ao-spacing-25": "100px",
    "--ao-spacing-26": "104px",
    "--ao-spacing-27": "108px",
    "--ao-spacing-28": "112px",
    "--ao-spacing-29": "116px",
    "--ao-spacing-30": "120px",
    "--ao-spacing-31": "124px",
    "--ao-spacing-32": "128px",
  };
}

// ── CSS generation ────────────────────────────────────────────────────────

function tokensToCSS(tokens: TokenDef): string {
  return Object.entries(tokens)
    .map(([k, v]) => `  ${k}: ${v};`)
    .join("\n");
}

function dualDeclarations(hex: TokenDef, wide: TokenDef): string {
  const lines: string[] = [];
  for (const key of Object.keys(hex)) {
    lines.push(`  ${key}: ${hex[key]};`);
    if (wide[key] && wide[key] !== hex[key]) lines.push(`  ${key}: ${wide[key]};`);
  }
  return lines.join("\n");
}

export function generateThemeCSS(): string {
  // Chart tokens use the sRGB palette on both sides so no P3 override is emitted.
  const themed = (theme: Theme) => {
    const chart = chartTokens(paletteFor(srgb, theme));
    return dualDeclarations(
      { ...colorTokens(theme, paletteFor(srgb, theme)), ...chart },
      { ...colorTokens(theme, paletteFor(p3, theme)), ...chart },
    );
  };

  const staticT = tokensToCSS(staticTokens());

  return `/* Generated by tokens/build.ts — do not edit directly */
/* Strategy: sRGB hex fallback → P3 override */
/* Browsers supporting color(display-p3) use wide-gamut; others use hex */

/* Light theme (default) */
:root, .light {
${themed("light")}
${staticT}
}

/* Dark theme */
.dark {
${themed("dark")}
${staticT}
}`;
}

// ── Design Token Generator ───────────────────────────────────────────────
// Generates CSS custom properties from Radix Colors at build time.
// Output: generated-tokens.css (imported by main.tsx)
//
// Strategy: dual-output — hex (sRGB) fallback first, then P3 override.
// Browsers that support color(display-p3 ...) use the wide-gamut values.
// All other browsers fall back to standard sRGB hex values.

import * as RadixColors from "@radix-ui/colors";

// ── Color scales (hex/sRGB for fallback) ─────────────────────────────────

const gray = {
  light: { 1: RadixColors.gray.gray1, 2: RadixColors.gray.gray2, 3: RadixColors.gray.gray3, 4: RadixColors.gray.gray4, 5: RadixColors.gray.gray5, 6: RadixColors.gray.gray6, 7: RadixColors.gray.gray7, 8: RadixColors.gray.gray8, 9: RadixColors.gray.gray9, 10: RadixColors.gray.gray10, 11: RadixColors.gray.gray11, 12: RadixColors.gray.gray12 },
  dark: { 1: RadixColors.grayDark.gray1, 2: RadixColors.grayDark.gray2, 3: RadixColors.grayDark.gray3, 4: RadixColors.grayDark.gray4, 5: RadixColors.grayDark.gray5, 6: RadixColors.grayDark.gray6, 7: RadixColors.grayDark.gray7, 8: RadixColors.grayDark.gray8, 9: RadixColors.grayDark.gray9, 10: RadixColors.grayDark.gray10, 11: RadixColors.grayDark.gray11, 12: RadixColors.grayDark.gray12 },
};

const accent = {
  light: { 1: RadixColors.cyan.cyan1, 2: RadixColors.cyan.cyan2, 3: RadixColors.cyan.cyan3, 4: RadixColors.cyan.cyan4, 5: RadixColors.cyan.cyan5, 6: RadixColors.cyan.cyan6, 7: RadixColors.cyan.cyan7, 8: RadixColors.cyan.cyan8, 9: RadixColors.cyan.cyan9, 10: RadixColors.cyan.cyan10, 11: RadixColors.cyan.cyan11, 12: RadixColors.cyan.cyan12 },
  dark: { 1: RadixColors.cyanDark.cyan1, 2: RadixColors.cyanDark.cyan2, 3: RadixColors.cyanDark.cyan3, 4: RadixColors.cyanDark.cyan4, 5: RadixColors.cyanDark.cyan5, 6: RadixColors.cyanDark.cyan6, 7: RadixColors.cyanDark.cyan7, 8: RadixColors.cyanDark.cyan8, 9: RadixColors.cyanDark.cyan9, 10: RadixColors.cyanDark.cyan10, 11: RadixColors.cyanDark.cyan11, 12: RadixColors.cyanDark.cyan12 },
};

const red = {
  light: { 1: RadixColors.red.red1, 3: RadixColors.red.red3, 5: RadixColors.red.red5, 9: RadixColors.red.red9, 10: RadixColors.red.red10, 11: RadixColors.red.red11 },
  dark: { 1: RadixColors.redDark.red1, 3: RadixColors.redDark.red3, 5: RadixColors.redDark.red5, 9: RadixColors.redDark.red9, 10: RadixColors.redDark.red10, 11: RadixColors.redDark.red11 },
};

const green = {
  light: { 1: RadixColors.green.green1, 3: RadixColors.green.green3, 5: RadixColors.green.green5, 9: RadixColors.green.green9, 10: RadixColors.green.green10, 11: RadixColors.green.green11 },
  dark: { 1: RadixColors.greenDark.green1, 3: RadixColors.greenDark.green3, 5: RadixColors.greenDark.green5, 9: RadixColors.greenDark.green9, 10: RadixColors.greenDark.green10, 11: RadixColors.greenDark.green11 },
};

const amber = {
  light: { 1: RadixColors.amber.amber1, 3: RadixColors.amber.amber3, 5: RadixColors.amber.amber5, 9: RadixColors.amber.amber9, 10: RadixColors.amber.amber10, 11: RadixColors.amber.amber11 },
  dark: { 1: RadixColors.amberDark.amber1, 3: RadixColors.amberDark.amber3, 5: RadixColors.amberDark.amber5, 9: RadixColors.amberDark.amber9, 10: RadixColors.amberDark.amber10, 11: RadixColors.amberDark.amber11 },
};

const blue = {
  light: { 1: RadixColors.blue.blue1, 3: RadixColors.blue.blue3, 5: RadixColors.blue.blue5, 9: RadixColors.blue.blue9, 10: RadixColors.blue.blue10, 11: RadixColors.blue.blue11 },
  dark: { 1: RadixColors.blueDark.blue1, 3: RadixColors.blueDark.blue3, 5: RadixColors.blueDark.blue5, 9: RadixColors.blueDark.blue9, 10: RadixColors.blueDark.blue10, 11: RadixColors.blueDark.blue11 },
};

// ── P3 color scales (wide-gamut override) ────────────────────────────────

const grayP3 = {
  light: { 1: RadixColors.grayP3.gray1, 2: RadixColors.grayP3.gray2, 3: RadixColors.grayP3.gray3, 4: RadixColors.grayP3.gray4, 5: RadixColors.grayP3.gray5, 6: RadixColors.grayP3.gray6, 7: RadixColors.grayP3.gray7, 8: RadixColors.grayP3.gray8, 9: RadixColors.grayP3.gray9, 10: RadixColors.grayP3.gray10, 11: RadixColors.grayP3.gray11, 12: RadixColors.grayP3.gray12 },
  dark: { 1: RadixColors.grayDarkP3.gray1, 2: RadixColors.grayDarkP3.gray2, 3: RadixColors.grayDarkP3.gray3, 4: RadixColors.grayDarkP3.gray4, 5: RadixColors.grayDarkP3.gray5, 6: RadixColors.grayDarkP3.gray6, 7: RadixColors.grayDarkP3.gray7, 8: RadixColors.grayDarkP3.gray8, 9: RadixColors.grayDarkP3.gray9, 10: RadixColors.grayDarkP3.gray10, 11: RadixColors.grayDarkP3.gray11, 12: RadixColors.grayDarkP3.gray12 },
};

const accentP3 = {
  light: { 1: RadixColors.cyanP3.cyan1, 2: RadixColors.cyanP3.cyan2, 3: RadixColors.cyanP3.cyan3, 4: RadixColors.cyanP3.cyan4, 5: RadixColors.cyanP3.cyan5, 6: RadixColors.cyanP3.cyan6, 7: RadixColors.cyanP3.cyan7, 8: RadixColors.cyanP3.cyan8, 9: RadixColors.cyanP3.cyan9, 10: RadixColors.cyanP3.cyan10, 11: RadixColors.cyanP3.cyan11, 12: RadixColors.cyanP3.cyan12 },
  dark: { 1: RadixColors.cyanDarkP3.cyan1, 2: RadixColors.cyanDarkP3.cyan2, 3: RadixColors.cyanDarkP3.cyan3, 4: RadixColors.cyanDarkP3.cyan4, 5: RadixColors.cyanDarkP3.cyan5, 6: RadixColors.cyanDarkP3.cyan6, 7: RadixColors.cyanDarkP3.cyan7, 8: RadixColors.cyanDarkP3.cyan8, 9: RadixColors.cyanDarkP3.cyan9, 10: RadixColors.cyanDarkP3.cyan10, 11: RadixColors.cyanDarkP3.cyan11, 12: RadixColors.cyanDarkP3.cyan12 },
};

const redP3 = {
  light: { 1: RadixColors.redP3.red1, 3: RadixColors.redP3.red3, 5: RadixColors.redP3.red5, 9: RadixColors.redP3.red9, 10: RadixColors.redP3.red10, 11: RadixColors.redP3.red11 },
  dark: { 1: RadixColors.redDarkP3.red1, 3: RadixColors.redDarkP3.red3, 5: RadixColors.redDarkP3.red5, 9: RadixColors.redDarkP3.red9, 10: RadixColors.redDarkP3.red10, 11: RadixColors.redDarkP3.red11 },
};

const greenP3 = {
  light: { 1: RadixColors.greenP3.green1, 3: RadixColors.greenP3.green3, 5: RadixColors.greenP3.green5, 9: RadixColors.greenP3.green9, 10: RadixColors.greenP3.green10, 11: RadixColors.greenP3.green11 },
  dark: { 1: RadixColors.greenDarkP3.green1, 3: RadixColors.greenDarkP3.green3, 5: RadixColors.greenDarkP3.green5, 9: RadixColors.greenDarkP3.green9, 10: RadixColors.greenDarkP3.green10, 11: RadixColors.greenDarkP3.green11 },
};

const amberP3 = {
  light: { 1: RadixColors.amberP3.amber1, 3: RadixColors.amberP3.amber3, 5: RadixColors.amberP3.amber5, 9: RadixColors.amberP3.amber9, 10: RadixColors.amberP3.amber10, 11: RadixColors.amberP3.amber11 },
  dark: { 1: RadixColors.amberDarkP3.amber1, 3: RadixColors.amberDarkP3.amber3, 5: RadixColors.amberDarkP3.amber5, 9: RadixColors.amberDarkP3.amber9, 10: RadixColors.amberDarkP3.amber10, 11: RadixColors.amberDarkP3.amber11 },
};

const blueP3 = {
  light: { 1: RadixColors.blueP3.blue1, 3: RadixColors.blueP3.blue3, 5: RadixColors.blueP3.blue5, 9: RadixColors.blueP3.blue9, 10: RadixColors.blueP3.blue10, 11: RadixColors.blueP3.blue11 },
  dark: { 1: RadixColors.blueDarkP3.blue1, 3: RadixColors.blueDarkP3.blue3, 5: RadixColors.blueDarkP3.blue5, 9: RadixColors.blueDarkP3.blue9, 10: RadixColors.blueDarkP3.blue10, 11: RadixColors.blueDarkP3.blue11 },
};

// ── Types ─────────────────────────────────────────────────────────────────

export type Theme = "light" | "dark";
export type TokenDef = Record<string, string>;

// ── Token generators ──────────────────────────────────────────────────────

type ColorScale = Record<number, string>;

function colorTokens(theme: Theme, g: ColorScale, a: ColorScale, r: ColorScale, gr: ColorScale, am: ColorScale, b: ColorScale): TokenDef {
  return {
    "--ao-background-primary": g[1], "--ao-background-secondary": g[3], "--ao-background-tertiary": g[5],
    "--ao-background-page": theme === "light" ? "#f9f9f9" : "#191919",
    "--ao-font-color-primary": g[12], "--ao-font-color-secondary": g[11], "--ao-font-color-tertiary": g[10], "--ao-font-color-disabled": g[8],
    "--ao-border-color-light": g[4], "--ao-border-color-medium": g[7], "--ao-border-color-strong": g[8],
    "--ao-accent-accent1": a[1], "--ao-accent-accent3": a[3], "--ao-accent-accent5": a[5], "--ao-accent-accent7": a[7], "--ao-accent-accent9": a[9], "--ao-accent-accent10": a[10], "--ao-accent-accent11": a[11],
    "--ao-color-red1": r[1], "--ao-color-red3": r[3], "--ao-color-red5": r[5], "--ao-color-red9": r[9], "--ao-color-red10": r[10], "--ao-color-red11": r[11],
    "--ao-color-green1": gr[1], "--ao-color-green3": gr[3], "--ao-color-green5": gr[5], "--ao-color-green9": gr[9], "--ao-color-green10": gr[10], "--ao-color-green11": gr[11],
    "--ao-color-amber1": am[1], "--ao-color-amber3": am[3], "--ao-color-amber5": am[5], "--ao-color-amber9": am[9], "--ao-color-amber10": am[10], "--ao-color-amber11": am[11],
    "--ao-color-blue1": b[1], "--ao-color-blue3": b[3], "--ao-color-blue5": b[5], "--ao-color-blue9": b[9], "--ao-color-blue10": b[10], "--ao-color-blue11": b[11],
  };
}

function staticTokens(): TokenDef {
  return {
    "--ao-font-family": '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    "--ao-font-family-mono": '"JetBrains Mono", "Fira Code", monospace',
    "--ao-font-size-xxs": "0.625rem", "--ao-font-size-xs": "0.85rem", "--ao-font-size-sm": "0.875rem", "--ao-font-size-md": "1rem", "--ao-font-size-lg": "1.125rem", "--ao-font-size-xl": "1.25rem", "--ao-font-size-2xl": "1.5rem", "--ao-font-size-3xl": "1.875rem",
    "--ao-font-weight-regular": "400", "--ao-font-weight-medium": "500", "--ao-font-weight-semibold": "600",
    "--ao-border-radius-xs": "2px", "--ao-border-radius-sm": "4px", "--ao-border-radius-md": "8px", "--ao-border-radius-lg": "12px", "--ao-border-radius-xl": "16px", "--ao-border-radius-pill": "999px", "--ao-border-radius-full": "100%", "--ao-border-radius-rounded": "100%",
    "--ao-spacing-0": "0px", "--ao-spacing-0_5": "2px", "--ao-spacing-1": "4px", "--ao-spacing-1_5": "6px", "--ao-spacing-2": "8px", "--ao-spacing-3": "12px", "--ao-spacing-4": "16px", "--ao-spacing-5": "20px", "--ao-spacing-6": "24px", "--ao-spacing-7": "28px", "--ao-spacing-8": "32px", "--ao-spacing-9": "36px", "--ao-spacing-10": "40px", "--ao-spacing-11": "44px", "--ao-spacing-12": "48px", "--ao-spacing-13": "52px", "--ao-spacing-14": "56px", "--ao-spacing-15": "60px", "--ao-spacing-16": "64px", "--ao-spacing-17": "68px", "--ao-spacing-18": "72px", "--ao-spacing-19": "76px", "--ao-spacing-20": "80px", "--ao-spacing-21": "84px", "--ao-spacing-22": "88px", "--ao-spacing-23": "92px", "--ao-spacing-24": "96px", "--ao-spacing-25": "100px", "--ao-spacing-26": "104px", "--ao-spacing-27": "108px", "--ao-spacing-28": "112px", "--ao-spacing-29": "116px", "--ao-spacing-30": "120px", "--ao-spacing-31": "124px", "--ao-spacing-32": "128px",
    "--ao-shadow-sm": "0 1px 2px rgba(0,0,0,0.06)", "--ao-shadow-md": "0 4px 6px rgba(0,0,0,0.07)",
  };
}

// ── CSS generation ────────────────────────────────────────────────────────

function tokensToCSS(tokens: TokenDef): string {
  return Object.entries(tokens).map(([k, v]) => `  ${k}: ${v};`).join("\n");
}

function dualDeclarations(hex: TokenDef, p3: TokenDef): string {
  const lines: string[] = [];
  for (const key of Object.keys(hex)) {
    lines.push(`  ${key}: ${hex[key]};`);
    if (p3[key]) lines.push(`  ${key}: ${p3[key]};`);
  }
  return lines.join("\n");
}

export function generateThemeCSS(): string {
  const t = (theme: Theme) => ({
    hex: colorTokens(theme, gray[theme], accent[theme], red[theme], green[theme], amber[theme], blue[theme]),
    p3: colorTokens(theme, grayP3[theme], accentP3[theme], redP3[theme], greenP3[theme], amberP3[theme], blueP3[theme]),
  });

  const light = t("light");
  const dark = t("dark");
  const staticT = tokensToCSS(staticTokens());

  const lightCSS = `${dualDeclarations(light.hex, light.p3)}\n${staticT}`;
  const darkCSS = `${dualDeclarations(dark.hex, dark.p3)}\n${staticT}`;

  return `/* Generated by tokens/build.ts — do not edit directly */
/* Strategy: sRGB hex fallback → P3 override */
/* Browsers supporting color(display-p3) use wide-gamut; others use hex */

/* Light theme (default) */
:root, .light {
${lightCSS}
}

/* Dark theme */
.dark {
${darkCSS}
}`;
}

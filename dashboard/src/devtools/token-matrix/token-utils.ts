import { useEffect, useState } from "react";

// ── CSS custom property reader ────────────────────────────────────────────

/**
 * Reads computed values for a list of CSS custom property names from the
 * document root. Re-reads on theme change (via a mutation observer on the
 * root element's class attribute).
 */
export function useTokenValues(tokenNames: string[]): Map<string, string> {
  const [values, setValues] = useState<Map<string, string>>(() => readTokens(tokenNames));

  useEffect(() => {
    const update = () => setValues(readTokens(tokenNames));
    update();

    const observer = new MutationObserver(update);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tokenNames.join(",")]);

  return values;
}

function readTokens(tokenNames: string[]): Map<string, string> {
  const styles = getComputedStyle(document.documentElement);
  const map = new Map<string, string>();
  for (const name of tokenNames) {
    const value = styles.getPropertyValue(name).trim();
    if (value) map.set(name, value);
  }
  return map;
}

/** Extract a subset of tokens from a full values map. */
export function filterMap(full: Map<string, string>, names: string[]): Map<string, string> {
  const out = new Map<string, string>();
  for (const name of names) {
    const v = full.get(name);
    if (v !== undefined) out.set(name, v);
  }
  return out;
}

/**
 * Given a CSS custom property value (e.g. "0 1px 2px rgba(0,0,0,0.06)"),
 * tries to extract a hex or rgb(...) color from it for the swatch preview.
 */
export function extractColorFromValue(raw: string): string | null {
  // Already a hex or named color
  const trimmed = raw.trim();
  if (/^#[0-9a-fA-F]{3,8}$/.test(trimmed)) return trimmed;
  if (/^rgba?\(/.test(trimmed)) return trimmed;
  if (/^color\(display-p3/.test(trimmed)) {
    // Extract the P3 values and convert to a rough sRGB hex for the swatch
    const match = trimmed.match(/display-p3\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)/);
    if (match) {
      const r = Math.round(Math.min(1, Number(match[1])) * 255);
      const g = Math.round(Math.min(1, Number(match[2])) * 255);
      const b = Math.round(Math.min(1, Number(match[3])) * 255);
      // oxlint-disable-next-line bentech/no-hardcoded-colors -- converts live token values for swatch display
      return `rgb(${r}, ${g}, ${b})`;
    }
  }
  return null;
}

/**
 * Convert a spacing value like "4px" to a numeric pixel value.
 */
export function spacingToPx(value: string): number {
  const num = parseFloat(value);
  if (value.endsWith("rem")) return num * 16;
  return num;
}

/**
 * Derive a human-friendly label from a token name.
 * "--ao-background-primary" → "background / primary"
 */
export function tokenLabel(name: string): string {
  return name.replace(/^--ao-/, "").replace(/-/g, " / ");
}

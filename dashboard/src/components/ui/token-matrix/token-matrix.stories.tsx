import type { Meta, StoryObj } from "@storybook/react";
import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";

// ── Token definitions ─────────────────────────────────────────────────────
// These are the stable `--ao-*` token names from generated-tokens.css.
// Values are read at runtime via getComputedStyle() so they stay in sync
// with the active theme (light / dark) selected in the Storybook toolbar.

type TokenGroup = {
  label: string;
  description?: string;
  tokens: string[];
};

const COLOR_GROUPS: TokenGroup[] = [
  {
    label: "Background",
    description: "Surface colors for page, cards, and layered containers.",
    tokens: [
      "--ao-background-primary",
      "--ao-background-secondary",
      "--ao-background-tertiary",
      "--ao-background-page",
    ],
  },
  {
    label: "Font Color",
    description: "Text colors from primary (headings) to disabled (placeholder).",
    tokens: [
      "--ao-font-color-primary",
      "--ao-font-color-secondary",
      "--ao-font-color-tertiary",
      "--ao-font-color-disabled",
    ],
  },
  {
    label: "Border",
    description: "Border colors for dividers, outlines, and focus rings.",
    tokens: [
      "--ao-border-color-light",
      "--ao-border-color-medium",
      "--ao-border-color-strong",
    ],
  },
  {
    label: "Accent (Cyan)",
    description: "Primary brand accent. Steps 1 (subtle) → 11 (vivid).",
    tokens: [
      "--ao-accent-accent1",
      "--ao-accent-accent3",
      "--ao-accent-accent5",
      "--ao-accent-accent7",
      "--ao-accent-accent9",
      "--ao-accent-accent10",
      "--ao-accent-accent11",
    ],
  },
  {
    label: "Red (Danger / Error)",
    description: "Used for destructive actions, error states, and offline device status.",
    tokens: [
      "--ao-color-red1",
      "--ao-color-red3",
      "--ao-color-red5",
      "--ao-color-red9",
      "--ao-color-red10",
      "--ao-color-red11",
    ],
  },
  {
    label: "Green (Success)",
    description: "Used for success states, online device status, and confirmation badges.",
    tokens: [
      "--ao-color-green1",
      "--ao-color-green3",
      "--ao-color-green5",
      "--ao-color-green9",
      "--ao-color-green10",
      "--ao-color-green11",
    ],
  },
  {
    label: "Amber (Warning)",
    description: "Used for warnings, pending states, and late attendance indicators.",
    tokens: [
      "--ao-color-amber1",
      "--ao-color-amber3",
      "--ao-color-amber5",
      "--ao-color-amber9",
      "--ao-color-amber10",
      "--ao-color-amber11",
    ],
  },
  {
    label: "Blue (Info)",
    description: "Used for informational states and links.",
    tokens: [
      "--ao-color-blue1",
      "--ao-color-blue3",
      "--ao-color-blue5",
      "--ao-color-blue9",
      "--ao-color-blue10",
      "--ao-color-blue11",
    ],
  },
];

const SPACING_TOKENS: string[] = [
  "--ao-spacing-0", "--ao-spacing-0_5", "--ao-spacing-1", "--ao-spacing-1_5",
  "--ao-spacing-2", "--ao-spacing-3", "--ao-spacing-4", "--ao-spacing-5",
  "--ao-spacing-6", "--ao-spacing-7", "--ao-spacing-8", "--ao-spacing-9",
  "--ao-spacing-10", "--ao-spacing-11", "--ao-spacing-12", "--ao-spacing-13",
  "--ao-spacing-14", "--ao-spacing-15", "--ao-spacing-16", "--ao-spacing-20",
  "--ao-spacing-24", "--ao-spacing-28", "--ao-spacing-32",
];

const RADIUS_TOKENS: string[] = [
  "--ao-border-radius-xs",
  "--ao-border-radius-sm",
  "--ao-border-radius-md",
  "--ao-border-radius-lg",
  "--ao-border-radius-xl",
  "--ao-border-radius-pill",
  "--ao-border-radius-full",
  "--ao-border-radius-rounded",
];

const FONT_SIZE_TOKENS: string[] = [
  "--ao-font-size-xxs",
  "--ao-font-size-xs",
  "--ao-font-size-sm",
  "--ao-font-size-md",
  "--ao-font-size-lg",
  "--ao-font-size-xl",
  "--ao-font-size-2xl",
  "--ao-font-size-3xl",
];

const FONT_WEIGHT_TOKENS: string[] = [
  "--ao-font-weight-regular",
  "--ao-font-weight-medium",
  "--ao-font-weight-semibold",
];

const FONT_FAMILY_TOKENS: string[] = [
  "--ao-font-family",
  "--ao-font-family-mono",
];

const SHADOW_TOKENS: string[] = [
  "--ao-shadow-sm",
  "--ao-shadow-md",
];

// ── CSS custom property reader ────────────────────────────────────────────

/**
 * Reads computed values for a list of CSS custom property names from the
 * document root. Re-reads on theme change (via a mutation observer on the
 * root element's class attribute).
 */
function useTokenValues(tokenNames: string[]): Map<string, string> {
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
function filterMap(full: Map<string, string>, names: string[]): Map<string, string> {
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
function extractColorFromValue(raw: string): string | null {
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
      return `rgb(${r}, ${g}, ${b})`;
    }
  }
  return null;
}

/**
 * Convert a spacing value like "4px" to a numeric pixel value.
 */
function spacingToPx(value: string): number {
  const num = parseFloat(value);
  if (value.endsWith("rem")) return num * 16;
  return num;
}

/**
 * Derive a human-friendly label from a token name.
 * "--ao-background-primary" → "background / primary"
 */
function tokenLabel(name: string): string {
  return name.replace(/^--ao-/, "").replace(/-/g, " / ");
}

// ── Sub-components for each token category ────────────────────────────────

function SectionHeading({ children }: { children: ReactNode }) {
  return (
    <h2
      style={{
        margin: "0 0 var(--ao-spacing-4) 0",
        fontSize: "var(--ao-font-size-xl)",
        fontWeight: "var(--ao-font-weight-semibold)",
        color: "var(--ao-font-color-primary)",
      }}
    >
      {children}
    </h2>
  );
}

function SectionDescription({ children }: { children: ReactNode }) {
  return (
    <p
      style={{
        margin: "calc(-1 * var(--ao-spacing-3)) 0 var(--ao-spacing-4) 0",
        fontSize: "var(--ao-font-size-sm)",
        color: "var(--ao-font-color-secondary)",
      }}
    >
      {children}
    </p>
  );
}

// ── Color Palette ─────────────────────────────────────────────────────────

function ColorGroupBlock({ group, values }: { group: TokenGroup; values: Map<string, string> }) {
  return (
    <div style={{ marginBottom: "var(--ao-spacing-6)" }}>
      <h3
        style={{
          margin: "0 0 var(--ao-spacing-1) 0",
          fontSize: "var(--ao-font-size-md)",
          fontWeight: "var(--ao-font-weight-semibold)",
          color: "var(--ao-font-color-primary)",
        }}
      >
        {group.label}
      </h3>
      {group.description && (
        <p
          style={{
            margin: "0 0 var(--ao-spacing-3) 0",
            fontSize: "var(--ao-font-size-sm)",
            color: "var(--ao-font-color-tertiary)",
          }}
        >
          {group.description}
        </p>
      )}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--ao-spacing-3)" }}>
        {group.tokens.map((name) => {
          const raw = values.get(name) ?? "";
          const color = extractColorFromValue(raw);
          return (
            <ColorSwatch key={name} name={tokenLabel(name)} rawValue={raw} color={color} />
          );
        })}
      </div>
    </div>
  );
}

function ColorSwatch({ name, rawValue, color }: { name: string; rawValue: string; color: string | null }) {
  const borderColor = "var(--ao-border-color-medium)";
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        borderRadius: "var(--ao-border-radius-md)",
        border: `1px solid ${borderColor}`,
        overflow: "hidden",
        width: 140,
        flexShrink: 0,
      }}
    >
      <div
        style={{
          height: 56,
          backgroundColor: color ?? extractColorFromValue(rawValue) ?? rawValue,
        }}
      />
      <div
        style={{
          padding: "var(--ao-spacing-1_5) var(--ao-spacing-2)",
          display: "flex",
          flexDirection: "column",
          gap: 2,
        }}
      >
        <span
          style={{
            fontSize: "var(--ao-font-size-xs)",
            fontWeight: "var(--ao-font-weight-medium)",
            color: "var(--ao-font-color-primary)",
            lineHeight: 1.3,
            wordBreak: "break-word",
          }}
        >
          {name}
        </span>
        <span
          style={{
            fontSize: "var(--ao-font-size-xxs)",
            color: "var(--ao-font-color-tertiary)",
            fontFamily: "var(--ao-font-family-mono)",
            lineHeight: 1.3,
            wordBreak: "break-all",
          }}
        >
          {rawValue}
        </span>
      </div>
    </div>
  );
}

// ── Spacing Scale ─────────────────────────────────────────────────────────

function SpacingScale({ values }: { values: Map<string, string> }) {
  const maxPx = useMemo(() => {
    let max = 0;
    for (const name of SPACING_TOKENS) {
      const v = spacingToPx(values.get(name) ?? "0px");
      if (v > max) max = v;
    }
    return max || 128;
  }, [values]);

  const barColor = "var(--ao-accent-accent9)";
  const mutedBarColor = "var(--ao-accent-accent5)";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--ao-spacing-1_5)" }}>
      {SPACING_TOKENS.map((name) => {
        const raw = values.get(name) ?? "";
        const px = spacingToPx(raw);
        const pct = Math.max(2, (px / maxPx) * 100);
        const label = tokenLabel(name);
        return (
          <div
            key={name}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "var(--ao-spacing-3)",
            }}
          >
            <span
              style={{
                width: 120,
                flexShrink: 0,
                textAlign: "right",
                fontSize: "var(--ao-font-size-xs)",
                color: "var(--ao-font-color-secondary)",
                fontFamily: "var(--ao-font-family-mono)",
              }}
            >
              {label}
            </span>
            <div
              style={{
                height: 24,
                width: `${pct}%`,
                minWidth: 2,
                borderRadius: "var(--ao-border-radius-xs)",
                background: `linear-gradient(90deg, ${barColor}, ${mutedBarColor})`,
                position: "relative",
              }}
            >
              <span
                style={{
                  position: "absolute",
                  right: -60,
                  top: "50%",
                  transform: "translateY(-50%)",
                  fontSize: "var(--ao-font-size-xxs)",
                  color: "var(--ao-font-color-tertiary)",
                  fontFamily: "var(--ao-font-family-mono)",
                  whiteSpace: "nowrap",
                }}
              >
                {raw}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Border Radius ─────────────────────────────────────────────────────────

function BorderRadiusScale({ values }: { values: Map<string, string> }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--ao-spacing-4)", alignItems: "flex-start" }}>
      {RADIUS_TOKENS.map((name) => {
        const raw = values.get(name) ?? "";
        const label = tokenLabel(name);
        return (
          <div
            key={name}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "var(--ao-spacing-1_5)",
            }}
          >
            <div
              style={{
                width: 72,
                height: 72,
                borderRadius: `var(${name})`,
                border: "2px solid var(--ao-accent-accent9)",
                backgroundColor: "var(--ao-accent-accent3)",
              }}
            />
            <span
              style={{
                fontSize: "var(--ao-font-size-xs)",
                color: "var(--ao-font-color-secondary)",
                fontFamily: "var(--ao-font-family-mono)",
                textAlign: "center",
              }}
            >
              {label}
            </span>
            <span
              style={{
                fontSize: "var(--ao-font-size-xxs)",
                color: "var(--ao-font-color-tertiary)",
                fontFamily: "var(--ao-font-family-mono)",
              }}
            >
              {raw}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ── Typography ────────────────────────────────────────────────────────────

function FontSizeScale({ values }: { values: Map<string, string> }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--ao-spacing-3)" }}>
      {FONT_SIZE_TOKENS.map((name) => {
        const raw = values.get(name) ?? "";
        const label = tokenLabel(name);
        return (
          <div
            key={name}
            style={{
              display: "flex",
              alignItems: "baseline",
              gap: "var(--ao-spacing-4)",
              padding: "var(--ao-spacing-1_5) 0",
              borderBottom: "1px solid var(--ao-border-color-light)",
            }}
          >
            <span
              style={{
                width: 100,
                flexShrink: 0,
                fontSize: "var(--ao-font-size-xs)",
                color: "var(--ao-font-color-tertiary)",
                fontFamily: "var(--ao-font-family-mono)",
              }}
            >
              {label}
            </span>
            <span
              style={{
                fontSize: `var(${name})`,
                fontWeight: "var(--ao-font-weight-regular)",
                color: "var(--ao-font-color-primary)",
                lineHeight: 1.4,
              }}
            >
              The quick brown fox jumps over the lazy dog.
            </span>
            <span
              style={{
                fontSize: "var(--ao-font-size-xxs)",
                color: "var(--ao-font-color-tertiary)",
                fontFamily: "var(--ao-font-family-mono)",
                whiteSpace: "nowrap",
                marginLeft: "auto",
              }}
            >
              {raw}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function FontWeightScale({ values }: { values: Map<string, string> }) {
  const sampleText = "Agile workflows, reliable outcomes.";
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--ao-spacing-3)" }}>
      {FONT_WEIGHT_TOKENS.map((name) => {
        const raw = values.get(name) ?? "";
        const label = tokenLabel(name);
        return (
          <div
            key={name}
            style={{
              display: "flex",
              alignItems: "baseline",
              gap: "var(--ao-spacing-4)",
              padding: "var(--ao-spacing-1_5) 0",
            }}
          >
            <span
              style={{
                width: 100,
                flexShrink: 0,
                fontSize: "var(--ao-font-size-xs)",
                color: "var(--ao-font-color-tertiary)",
                fontFamily: "var(--ao-font-family-mono)",
              }}
            >
              {label}
            </span>
            <span
              style={{
                fontSize: "var(--ao-font-size-lg)",
                fontWeight: `var(${name})`,
                color: "var(--ao-font-color-primary)",
              }}
            >
              {sampleText}
            </span>
            <span
              style={{
                fontSize: "var(--ao-font-size-xxs)",
                color: "var(--ao-font-color-tertiary)",
                fontFamily: "var(--ao-font-family-mono)",
                whiteSpace: "nowrap",
                marginLeft: "auto",
              }}
            >
              {raw}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function FontFamilyScale({ values }: { values: Map<string, string> }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--ao-spacing-3)" }}>
      {FONT_FAMILY_TOKENS.map((name) => {
        const raw = values.get(name) ?? "";
        const label = tokenLabel(name);
        return (
          <div
            key={name}
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "var(--ao-spacing-1)",
              padding: "var(--ao-spacing-3)",
              borderRadius: "var(--ao-border-radius-md)",
              border: "1px solid var(--ao-border-color-light)",
            }}
          >
            <span
              style={{
                fontSize: "var(--ao-font-size-xs)",
                color: "var(--ao-font-color-tertiary)",
                fontFamily: "var(--ao-font-family-mono)",
              }}
            >
              {label} — {raw}
            </span>
            <span
              style={{
                fontSize: "var(--ao-font-size-lg)",
                fontFamily: `var(${name})`,
                color: "var(--ao-font-color-primary)",
              }}
            >
              ABCDEFGHIJKLMNOPQRSTUVWXYZ abcdefghijklmnopqrstuvwxyz 0123456789
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ── Shadows ───────────────────────────────────────────────────────────────

function ShadowScale({ values }: { values: Map<string, string> }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--ao-spacing-4)" }}>
      {SHADOW_TOKENS.map((name) => {
        const raw = values.get(name) ?? "";
        const label = tokenLabel(name);
        return (
          <div
            key={name}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "var(--ao-spacing-2)",
            }}
          >
            <div
              style={{
                width: 120,
                height: 80,
                borderRadius: "var(--ao-border-radius-md)",
                backgroundColor: "var(--ao-background-primary)",
                border: "1px solid var(--ao-border-color-light)",
                boxShadow: `var(${name})`,
              }}
            />
            <span
              style={{
                fontSize: "var(--ao-font-size-xs)",
                color: "var(--ao-font-color-secondary)",
                fontFamily: "var(--ao-font-family-mono)",
              }}
            >
              {label}
            </span>
            <span
              style={{
                fontSize: "var(--ao-font-size-xxs)",
                color: "var(--ao-font-color-tertiary)",
                fontFamily: "var(--ao-font-family-mono)",
                maxWidth: 140,
                textAlign: "center",
                wordBreak: "break-all",
              }}
            >
              {raw}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ── Border Preview ────────────────────────────────────────────────────────

const BORDER_TOKENS = [
  "--ao-border-color-light",
  "--ao-border-color-medium",
  "--ao-border-color-strong",
];

function BorderPreview({ values }: { values: Map<string, string> }) {
  return (
    <div style={{ display: "flex", gap: "var(--ao-spacing-4)", flexWrap: "wrap", alignItems: "flex-start" }}>
      {BORDER_TOKENS.map((name) => {
        const raw = values.get(name) ?? "";
        const label = tokenLabel(name);
        return (
          <div
            key={name}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "var(--ao-spacing-1_5)",
            }}
          >
            <div
              style={{
                width: 80,
                height: 80,
                borderRadius: "var(--ao-border-radius-md)",
                border: `3px solid var(${name})`,
                backgroundColor: "var(--ao-background-secondary)",
              }}
            />
            <span
              style={{
                fontSize: "var(--ao-font-size-xs)",
                color: "var(--ao-font-color-secondary)",
                fontFamily: "var(--ao-font-family-mono)",
                textAlign: "center",
              }}
            >
              {label}
            </span>
            <span
              style={{
                fontSize: "var(--ao-font-size-xxs)",
                color: "var(--ao-font-color-tertiary)",
                fontFamily: "var(--ao-font-family-mono)",
              }}
            >
              {raw}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ── Font Color Preview ────────────────────────────────────────────────────

const FONT_COLOR_TOKENS = [
  "--ao-font-color-primary",
  "--ao-font-color-secondary",
  "--ao-font-color-tertiary",
  "--ao-font-color-disabled",
];

function FontColorPreview({ values }: { values: Map<string, string> }) {
  const sampleText = "Sample text color";
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--ao-spacing-4)", alignItems: "center" }}>
      {FONT_COLOR_TOKENS.map((name) => {
        const label = tokenLabel(name);
        const raw = values.get(name) ?? "";
        return (
          <div
            key={name}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "var(--ao-spacing-1)",
              padding: "var(--ao-spacing-3)",
              borderRadius: "var(--ao-border-radius-md)",
              backgroundColor: "var(--ao-background-primary)",
              border: "1px solid var(--ao-border-color-light)",
              minWidth: 140,
            }}
          >
            <span
              style={{
                fontSize: "var(--ao-font-size-md)",
                fontWeight: "var(--ao-font-weight-medium)",
                color: `var(${name})`,
              }}
            >
              {sampleText}
            </span>
            <span
              style={{
                fontSize: "var(--ao-font-size-xs)",
                color: "var(--ao-font-color-tertiary)",
                fontFamily: "var(--ao-font-family-mono)",
                textAlign: "center",
              }}
            >
              {label}
            </span>
            <span
              style={{
                fontSize: "var(--ao-font-size-xxs)",
                color: "var(--ao-font-color-tertiary)",
                fontFamily: "var(--ao-font-family-mono)",
                wordBreak: "break-all",
                textAlign: "center",
                lineHeight: 1.2,
              }}
            >
              {raw}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ── Page Shell ────────────────────────────────────────────────────────────

const PAGE_STYLE: CSSProperties = {
  padding: "var(--ao-spacing-6)",
  maxWidth: 960,
  margin: "0 auto",
  display: "flex",
  flexDirection: "column",
  gap: "var(--ao-spacing-8)",
};

const SECTION_STYLE: CSSProperties = {
  padding: "var(--ao-spacing-5)",
  borderRadius: "var(--ao-border-radius-lg)",
  border: "1px solid var(--ao-border-color-light)",
  backgroundColor: "var(--ao-background-primary)",
};

// ── Meta ─────────────────────────────────────────────────────────────────
// This is a docs-only story page; there is no standalone component to export.
// We use a small presentational wrapper as the component target.

/** All token names used anywhere on the page, deduplicated for a single read. */
const ALL_TOKEN_NAMES = [
  ...COLOR_GROUPS.flatMap((g) => g.tokens),
  ...SPACING_TOKENS,
  ...RADIUS_TOKENS,
  ...FONT_SIZE_TOKENS,
  ...FONT_WEIGHT_TOKENS,
  ...FONT_FAMILY_TOKENS,
  ...SHADOW_TOKENS,
  ...BORDER_TOKENS,
  ...FONT_COLOR_TOKENS,
];

function TokenMatrixPage() {
  // Single read of all CSS custom properties — one MutationObserver for theme switching.
  const values = useTokenValues(ALL_TOKEN_NAMES);

  // Subsets for individual sections (derived from the same map).
  const spacingValues = useMemo(() => filterMap(values, SPACING_TOKENS), [values]);
  const radiusValues = useMemo(() => filterMap(values, RADIUS_TOKENS), [values]);
  const fontSizeValues = useMemo(() => filterMap(values, FONT_SIZE_TOKENS), [values]);
  const fontWeightValues = useMemo(() => filterMap(values, FONT_WEIGHT_TOKENS), [values]);
  const fontFamilyValues = useMemo(() => filterMap(values, FONT_FAMILY_TOKENS), [values]);
  const shadowValues = useMemo(() => filterMap(values, SHADOW_TOKENS), [values]);
  const borderValues = useMemo(() => filterMap(values, BORDER_TOKENS), [values]);
  const fontColorValues = useMemo(() => filterMap(values, FONT_COLOR_TOKENS), [values]);

  return (
    <div style={PAGE_STYLE}>
      {/* Header */}
      <div>
        <h1
          style={{
            margin: "0 0 var(--ao-spacing-1) 0",
            fontSize: "var(--ao-font-size-2xl)",
            fontWeight: "var(--ao-font-weight-semibold)",
            color: "var(--ao-font-color-primary)",
          }}
        >
          Design Tokens
        </h1>
        <p
          style={{
            margin: 0,
            fontSize: "var(--ao-font-size-sm)",
            color: "var(--ao-font-color-secondary)",
          }}
        >
          Every <code style={{ fontFamily: "var(--ao-font-family-mono)", fontSize: "var(--ao-font-size-xs)" }}>--ao-*</code> CSS custom property used in the design system.
          Switch between Light and Dark in the toolbar to see theme variants.
        </p>
      </div>

      {/* ── Colors ── */}
      <div style={SECTION_STYLE}>
        <SectionHeading>Color Palette</SectionHeading>
        <SectionDescription>
          Semantic color tokens derived from Radix Colors. Each scale has steps
          from 1 (lightest background) to 11 (most vivid foreground).
        </SectionDescription>
        {COLOR_GROUPS.map((group) => (
                  <ColorGroupBlock key={group.label} group={group} values={values} />
                ))}
      </div>

      {/* ── Font Colors ── */}
      <div style={SECTION_STYLE}>
        <SectionHeading>Font Colors</SectionHeading>
        <SectionDescription>
          Text color tokens applied via the <code>Text</code> component color prop.
        </SectionDescription>
        <FontColorPreview values={fontColorValues} />
      </div>

      {/* ── Spacing Scale ── */}
      <div style={SECTION_STYLE}>
        <SectionHeading>Spacing Scale</SectionHeading>
        <SectionDescription>
          The 4px base grid. Values from 0 → 128px covering every layout need.
          The bar width is proportional to the pixel value.
        </SectionDescription>
        <SpacingScale values={spacingValues} />
      </div>

      {/* ── Border Radius ── */}
      <div style={SECTION_STYLE}>
        <SectionHeading>Border Radius</SectionHeading>
        <SectionDescription>
          Corner rounding tokens from sharp (2px) to fully circular (100%).
        </SectionDescription>
        <BorderRadiusScale values={radiusValues} />
      </div>

      {/* ── Borders ── */}
      <div style={SECTION_STYLE}>
        <SectionHeading>Border Colors</SectionHeading>
        <SectionDescription>
          Border strength tokens: light (subtle dividers), medium (card outlines), strong (focused rings).
        </SectionDescription>
        <BorderPreview values={borderValues} />
      </div>

      {/* ── Typography ── */}
      <div style={SECTION_STYLE}>
        <SectionHeading>Typography</SectionHeading>

        <h3
          style={{
            margin: "0 0 var(--ao-spacing-3) 0",
            fontSize: "var(--ao-font-size-md)",
            fontWeight: "var(--ao-font-weight-semibold)",
            color: "var(--ao-font-color-primary)",
          }}
        >
          Font Sizes
        </h3>
        <SectionDescription>
          From xxs (10px) to 3xl (30px). Each size shown with a representative sentence.
        </SectionDescription>
        <FontSizeScale values={fontSizeValues} />

        <div style={{ height: "var(--ao-spacing-5)" }} />

        <h3
          style={{
            margin: "0 0 var(--ao-spacing-3) 0",
            fontSize: "var(--ao-font-size-md)",
            fontWeight: "var(--ao-font-weight-semibold)",
            color: "var(--ao-font-color-primary)",
          }}
        >
          Font Weights
        </h3>
        <SectionDescription>
          Regular (400), Medium (500), Semibold (600).
        </SectionDescription>
        <FontWeightScale values={fontWeightValues} />

        <div style={{ height: "var(--ao-spacing-5)" }} />

        <h3
          style={{
            margin: "0 0 var(--ao-spacing-3) 0",
            fontSize: "var(--ao-font-size-md)",
            fontWeight: "var(--ao-font-weight-semibold)",
            color: "var(--ao-font-color-primary)",
          }}
        >
          Font Families
        </h3>
        <SectionDescription>
          Inter (UI) and JetBrains Mono (code/data).
        </SectionDescription>
        <FontFamilyScale values={fontFamilyValues} />
      </div>

      {/* ── Shadows ── */}
      <div style={SECTION_STYLE}>
        <SectionHeading>Shadows</SectionHeading>
        <SectionDescription>
          Box shadow tokens for elevation (sm, md).
        </SectionDescription>
        <ShadowScale values={shadowValues} />
      </div>
    </div>
  );
}

const meta: Meta<typeof TokenMatrixPage> = {
  title: "Tokens / Design Tokens",
  component: TokenMatrixPage,
  tags: ["autodocs"],
  parameters: {
    controls: { disable: true },
    layout: "fullscreen",
  },
};

export default meta;
type Story = StoryObj<typeof TokenMatrixPage>;

/** Complete design token reference — every --ao-* CSS custom property visualized. */
export const AllTokens: Story = {
  name: "Design Tokens",
  render: () => <TokenMatrixPage />,
};

import type { Theme } from "@/infrastructure/theme";

/**
 * Convert a CSS color value to a d3-color-compatible format.
 *
 * The theme system resolves CSS custom properties via getComputedStyle(),
 * which returns `color(display-p3 …)` for tokens that have P3 fallbacks.
 * d3-color (used internally by Nivo) cannot parse that format — it only
 * understands hex, rgb(), rgba(), hsl(), and named colors. Without this
 * converter, tooltips, hover effects, and color interpolations silently
 * break even though the bars render fine (chart palette tokens are hex-only).
 *
 * KEEP THIS — do not remove unless the design token pipeline stops emitting
 * P3 fallback declarations in generated-tokens.css.
 */
export function toSRGB(color: string): string {
  const match =
    /^color\(display-p3\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)(?:\s*\/\s*([\d.]+))?\s*\)$/.exec(color);
  if (!match) return color;

  const r = Math.round(Math.min(1, Math.max(0, Number(match[1]))) * 255);
  const g = Math.round(Math.min(1, Math.max(0, Number(match[2]))) * 255);
  const b = Math.round(Math.min(1, Math.max(0, Number(match[3]))) * 255);

  const fnPrefix = match[4] !== undefined ? "rgba" : "rgb";
  const alpha = match[4] !== undefined ? Math.min(1, Math.max(0, Number(match[4]))) : null;
  return alpha !== null
    ? `${fnPrefix}(${r}, ${g}, ${b}, ${alpha})`
    : `${fnPrefix}(${r}, ${g}, ${b})`;
}

/**
 * Build a polished Nivo theme from resolved design tokens.
 *
 * Design principles:
 * - Grid lines are subtle — they guide the eye without competing with data.
 * - Axis labels use tertiary color at 11px — small, legible, unobtrusive.
 * - Tooltips match the app's card design (shadow, radius, padding).
 * - Crosshair (line charts) uses a dashed primary-accent line.
 * - Annotations stand out with medium-weight secondary text.
 * - All colors pass through toSRGB() so d3-color never receives P3 format.
 */
export function buildNivoTheme(theme: Theme) {
  const textSecondary = toSRGB(theme.font.color.secondary);
  const textTertiary = toSRGB(theme.font.color.tertiary);
  const borderLight = toSRGB(theme.border.color.light);
  const borderMedium = toSRGB(theme.border.color.medium);
  const textPrimary = toSRGB(theme.font.color.primary);

  return {
    background: "transparent",

    // ── Typography ────────────────────────────────────────────────
    text: {
      fontFamily: theme.font.family,
      fontSize: 11,
      fill: textTertiary,
      outlineWidth: 0,
    },

    // ── Tooltip ───────────────────────────────────────────────────
    //
    // Inverted style matching our design-system TooltipComponent:
    //   dark bg (--ao-font-color-primary), light text (--ao-background-primary).
    //   Same radius (4px), font size (xs), and padding as Base UI tooltips.
    //   Ref: src/components/ui/tooltip/tooltip.module.scss
    tooltip: {
      container: {
        background: toSRGB(theme.font.color.primary),
        color: toSRGB(theme.background.primary),
        fontSize: "12px",
        borderRadius: "4px",
        boxShadow: theme.shadow.md,
        padding: "6px 10px",
      },
    },

    // ── Axes ──────────────────────────────────────────────────────
    axis: {
      domain: {
        line: {
          stroke: borderLight,
          strokeWidth: 1,
        },
      },
      ticks: {
        line: {
          stroke: borderLight,
          strokeWidth: 1,
        },
        text: {
          fill: textTertiary,
          fontSize: 11,
        },
      },
      legend: {
        text: {
          fill: textSecondary,
          fontSize: 12,
          fontWeight: 500,
        },
      },
    },

    // ── Grid ──────────────────────────────────────────────────────
    grid: {
      line: {
        stroke: borderLight,
        strokeWidth: 1,
        strokeDasharray: "4 4",
      },
    },

    // ── Legends ───────────────────────────────────────────────────
    legends: {
      text: {
        fill: textSecondary,
        fontSize: 12,
      },
      title: {
        text: {
          fill: textPrimary,
          fontSize: 12,
          fontWeight: 600,
        },
      },
    },

    // ── Data Labels ───────────────────────────────────────────────
    labels: {
      text: {
        fill: textPrimary,
        fontSize: 11,
        fontWeight: 500,
      },
    },

    // ── Crosshair (line chart hover indicator) ────────────────────
    crosshair: {
      line: {
        stroke: toSRGB(theme.chart.primary),
        strokeWidth: 1,
        strokeDasharray: "6 3",
        strokeOpacity: 0.35,
      },
    },

    // ── Dots / Points (line chart) ────────────────────────────────
    dots: {
      text: {
        fill: textSecondary,
        fontSize: 12,
      },
    },

    // ── Annotations ───────────────────────────────────────────────
    annotations: {
      text: {
        fill: textSecondary,
        fontSize: 12,
        fontWeight: 500,
      },
      link: {
        stroke: borderMedium,
        strokeWidth: 1.5,
      },
      outline: {
        stroke: borderMedium,
        strokeWidth: 1.5,
      },
    },
  };
}

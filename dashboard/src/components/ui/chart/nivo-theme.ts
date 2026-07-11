import type { Theme } from "@/infrastructure/theme";

/**
 * Build a Nivo theme from the resolved design tokens.
 *
 * Nivo applies many theme colors as SVG presentation *attributes* and runs
 * series colors through d3-color, so it needs concrete color values —
 * `var(--ao-*)` strings silently break there. The `theme` argument comes
 * from `useTheme()`, which resolves every token via getComputedStyle and
 * re-resolves when the color scheme changes, so charts restyle on theme
 * switch automatically.
 */
export function buildNivoTheme(theme: Theme) {
  return {
    background: "transparent",
    text: {
      fontFamily: theme.font.family,
      fontSize: 12,
      fill: theme.font.color.tertiary,
      outlineWidth: 0,
    },
    axis: {
      domain: {
        line: {
          stroke: theme.border.color.light,
          strokeWidth: 1,
        },
      },
      ticks: {
        line: {
          stroke: theme.border.color.light,
          strokeWidth: 1,
        },
        text: {
          fill: theme.font.color.tertiary,
          fontSize: 12,
        },
      },
      legend: {
        text: {
          fill: theme.font.color.secondary,
          fontSize: 12,
          fontWeight: 500,
        },
      },
    },
    grid: {
      line: {
        stroke: theme.border.color.light,
        strokeWidth: 1,
      },
    },
    legends: {
      text: {
        fill: theme.font.color.secondary,
        fontSize: 12,
      },
    },
    labels: {
      text: {
        fill: theme.font.color.primary,
        fontSize: 11,
        fontWeight: 500,
      },
    },
    tooltip: {
      container: {
        background: theme.background.primary,
        color: theme.font.color.primary,
        fontSize: 12,
        borderRadius: theme.border.radius.sm,
        boxShadow: theme.shadow.sm,
      },
    },
    annotations: {
      text: {
        fill: theme.font.color.secondary,
        fontSize: 12,
      },
      link: {
        stroke: theme.border.color.medium,
      },
      outline: {
        stroke: theme.border.color.medium,
      },
    },
  };
}

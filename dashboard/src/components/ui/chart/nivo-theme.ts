/**
 * Shared Nivo theme mapping our `--ao-*` design tokens.
 *
 * CSS custom properties work in SVG inline styles on all modern browsers,
 * so `var(--ao-*)` values resolve at render time, giving automatic
 * light/dark mode support.
 */

export const nivoTheme = {
  background: "transparent",
  text: {
    fontFamily: "var(--ao-font-family)",
    fontSize: 12,
    fill: "var(--ao-font-color-tertiary)",
    outlineWidth: 0,
  },
  axis: {
    domain: {
      line: {
        stroke: "var(--ao-border-color-light)",
        strokeWidth: 1,
      },
    },
    ticks: {
      line: {
        stroke: "var(--ao-border-color-light)",
        strokeWidth: 1,
      },
      text: {
        fill: "var(--ao-font-color-tertiary)",
        fontSize: 12,
      },
    },
    legend: {
      text: {
        fill: "var(--ao-font-color-secondary)",
        fontSize: 12,
        fontWeight: 500,
      },
    },
  },
  grid: {
    line: {
      stroke: "var(--ao-border-color-light)",
      strokeWidth: 1,
    },
  },
  legends: {
    text: {
      fill: "var(--ao-font-color-secondary)",
      fontSize: 12,
    },
  },
  labels: {
    text: {
      fill: "var(--ao-font-color-primary)",
      fontSize: 11,
      fontWeight: 500,
    },
  },
  tooltip: {
    container: {
      background: "var(--ao-background-primary)",
      color: "var(--ao-font-color-primary)",
      fontSize: 12,
      borderRadius: "var(--ao-border-radius-sm)",
      boxShadow: "var(--ao-shadow-sm)",
    },
  },
  annotations: {
    text: {
      fill: "var(--ao-font-color-secondary)",
      fontSize: 12,
    },
    link: {
      stroke: "var(--ao-border-color-medium)",
    },
    outline: {
      stroke: "var(--ao-border-color-medium)",
    },
  },
};

import type React from "react";

/**
 * Chart tooltip style shared across all Nivo chart components.
 *
 * Matches our design-system TooltipComponent (Base UI):
 *   inverted colors (dark bg from --ao-font-color-primary,
 *   light text from --ao-background-primary).
 *   Same radius, font, and padding as Base UI tooltips.
 *
 * Refs:
 *   src/components/ui/tooltip/tooltip.module.scss
 *   src/components/ui/chart/nivo-theme.ts (tooltip section)
 */

export type ChartTooltipTokens = {
  background: string;
  color: string;
  fontFamily: string;
};

/** Build a React.CSSProperties object for an inverted chart tooltip. */
export function chartTooltipStyle(t: ChartTooltipTokens): React.CSSProperties {
  return {
    background: t.background,
    color: t.color,
    padding: "6px 10px",
    borderRadius: "4px",
    boxShadow: "0 2px 8px rgba(0,0,0,0.12)",
    fontSize: "12px",
    fontFamily: t.fontFamily,
    lineHeight: 1.4,
    pointerEvents: "none",
  };
}

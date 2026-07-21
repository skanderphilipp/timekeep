import type { ReactNode } from "react";

import { useChartTheme } from "./use-chart-theme";
import { chartTooltipStyle } from "./chart-tooltip-style";

export type ChartTooltipProps = {
  /** Main label (e.g., "Check In", "Jul 10"). Bold, primary line. */
  label: ReactNode;
  /** Value line (e.g., "245 punches", "38.5%"). */
  value?: ReactNode;
  /** Optional secondary info line — smaller, muted. */
  secondary?: ReactNode;
};

/**
 * Standard chart tooltip matching the design system.
 *
 * Inverted card style — dark background, light text, 4px radius,
 * design-token shadow. Consistent with Base UI tooltips and the
 * CalendarChart tooltip renderer.
 *
 * Used by PieChart, BarChart, LineChart wrappers via their `tooltip` props.
 */
export function ChartTooltip({ label, value, secondary }: ChartTooltipProps) {
  const { nivo } = useChartTheme();

  const style = chartTooltipStyle({
    background: nivo.tooltip?.container?.background ?? "var(--ao-font-color-primary)",
    color: nivo.tooltip?.container?.color ?? "var(--ao-background-primary)",
    fontFamily: nivo.text?.fontFamily ?? "Inter, sans-serif",
  });

  return (
    <div data-slot="chart-tooltip" style={style}>
      <strong>{label}</strong>
      {value != null && (
        <>
          <br />
          {value}
        </>
      )}
      {secondary != null && (
        <>
          <br />
          <span style={{ opacity: 0.7, fontSize: "11px" }}>{secondary}</span>
        </>
      )}
    </div>
  );
}

import { ResponsiveCalendar, type CalendarTooltipProps } from "@nivo/calendar";

import { useChartTheme } from "./use-chart-theme";
import { chartTooltipStyle } from "./chart-tooltip-style";
import { formatDurationHours } from "@/lib/format-duration";

// ── Types ──────────────────────────────────────────────────────────────

/** Attendance status for a calendar day. */
export type CalendarDayStatus = "full" | "half" | "late" | "absent" | "weekend";

/** Single day in the attendance calendar. */
export type CalendarDay = {
  day: string;
  value: number;
  hours: number | null;
  status: CalendarDayStatus;
};

export type CalendarChartProps = {
  data: CalendarDay[];
  from: string;
  to: string;
  height?: number;
  /** Called when a day cell is clicked. Parent shows Daily Detail section. */
  onClick?: (day: CalendarDay) => void;
};

// ── Constants ──────────────────────────────────────────────────────────

const STATUS_COLORS = [
  "var(--ao-chart-neutral)",
  "var(--ao-chart-negative)",
  "var(--ao-chart-warning)",
  "var(--ao-chart-info)",
  "var(--ao-chart-positive)",
];

const STATUS_LABELS: Record<number, string> = {
  0: "Weekend",
  1: "Absent",
  2: "Late",
  3: "Half Day",
  4: "Full Day",
};

// ── Helpers ────────────────────────────────────────────────────────────

function formatDay(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(y!, m! - 1, d!);
  return date.toLocaleDateString("en", { month: "short", day: "numeric" });
}

// ── Component ──────────────────────────────────────────────────────────

/**
 * Attendance calendar heatmap for the Employee Detail page.
 *
 * User story (Section 4):
 *   Each day color-coded by status. Click → Daily Detail section.
 *   Green=full, amber=late, red=absent, gray=weekend.
 */
export function CalendarChart({ data, from, to, height = 300, onClick }: CalendarChartProps) {
  const { nivo, resolveColor } = useChartTheme();

  const colors = STATUS_COLORS.map(resolveColor);

  // Tooltip style matching our design system (inverted card).
  const tooltipStyle = chartTooltipStyle({
    background: nivo.tooltip?.container?.background ?? "var(--ao-font-color-primary)",
    color: nivo.tooltip?.container?.color ?? "var(--ao-background-primary)",
    fontFamily: nivo.text?.fontFamily ?? "Inter, sans-serif",
  });

  return (
    <div data-slot="calendar-chart" style={{ width: "100%", height: `${height}px` }}>
      <ResponsiveCalendar
        data={data}
        from={from}
        to={to}
        theme={nivo}
        // ── Color scale ──────────────────────────────────────────
        colors={colors}
        emptyColor={colors[0]!}
        minValue={0}
        maxValue={STATUS_COLORS.length - 1}
        // ── Layout — enough space for legends ────────────────────
        // monthLegend is auto-positioned; margins must be ≥ legend offset.
        margin={{ top: 28, right: 8, bottom: 8, left: 36 }}
        direction="horizontal"
        align="center"
        // ── Borders & spacing ────────────────────────────────────
        monthBorderWidth={1}
        monthBorderColor={nivo.grid?.line?.stroke ?? "var(--ao-border-color-light)"}
        dayBorderWidth={1}
        dayBorderColor="transparent"
        daySpacing={2}
        monthSpacing={8}
        // ── Legends ──────────────────────────────────────────────
        yearLegend={(year) => `${year}`}
        yearSpacing={24}
        yearLegendOffset={8}
        monthLegendOffset={8}
        // ── Accessibility ────────────────────────────────────────
        role="img"
        // ── Interaction ──────────────────────────────────────────
        isInteractive={true}
        onClick={(cell) => {
          const hit = data.find((d) => d.day === cell.day);
          if (hit) onClick?.(hit);
        }}
        // ── Tooltip ───────────────────────────────────────────────
        tooltip={({ day: iso, value }: CalendarTooltipProps) => {
          const hit = data.find((d) => d.day === iso);
          const hours = hit?.hours ?? null;
          const label = hit?.status
            ? hit.status.charAt(0).toUpperCase() + hit.status.slice(1)
            : (STATUS_LABELS[Number(value) as keyof typeof STATUS_LABELS] ?? "—");

          return (
            <div data-slot="calendar-chart-tooltip" style={tooltipStyle}>
              <strong>{formatDay(iso)}</strong>
              <br />
              {formatDurationHours(hours)}
              {" · "}
              {label}
            </div>
          );
        }}
      />
    </div>
  );
}

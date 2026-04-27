import { useMemo } from "react";
import { useLingui } from "@lingui/react";
import { msg } from "@lingui/core/macro";

import { Chart, BarChart } from "@/components/ui";
import type { DashboardHourlyBreakdown } from "@/lib/api";

type HourlyArrivalsChartProps = {
  hourlyBreakdown?: DashboardHourlyBreakdown[];
  isLoading?: boolean;
  error?: Error | null;
};

/**
 * Hourly arrivals chart for the dashboard.
 *
 * Uses the `hourly_breakdown` array from `TodaySummary` — no separate API call.
 * Shows check-in counts grouped by hour of day.
 */
export function HourlyArrivalsChart({ hourlyBreakdown, isLoading, error }: HourlyArrivalsChartProps) {
  const { _ } = useLingui();

  const chartData = useMemo(() => {
    if (!hourlyBreakdown || hourlyBreakdown.length === 0) return [];
    // Fill in missing hours with zero
    const filled: { hour: string; count: number }[] = [];
    for (let h = 0; h < 24; h++) {
      const entry = hourlyBreakdown.find((e) => e.hour === h);
      filled.push({
        hour: `${String(h).padStart(2, "0")}:00`,
        count: entry?.count ?? 0,
      });
    }
    return filled;
  }, [hourlyBreakdown]);

  return (
    <Chart
      title={_(msg`Hourly Arrivals`)}
      description={_(msg`Check-ins grouped by hour of day.`)}
      isLoading={isLoading}
      error={error ?? null}
      isEmpty={chartData.every((d) => d.count === 0)}
      emptyMessage={_(msg`No arrivals yet today.`)}
      height={240}
    >
      <BarChart
        data={chartData}
        bars={[
          {
            dataKey: "count",
            fill: "var(--ao-accent-accent9)",
            name: _(msg`Arrivals`),
            radius: [4, 4, 0, 0],
          },
        ]}
        xKey="hour"
        grid
      />
    </Chart>
  );
}

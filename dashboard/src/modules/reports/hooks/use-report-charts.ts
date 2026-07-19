import { useMemo } from "react";
import { useLingui } from "@lingui/react";
import { msg } from "@lingui/core/macro";
import { setISOWeek, startOfISOWeek, endOfISOWeek, format } from "date-fns";
import type { ReportSummary } from "@/lib/api";
import { formatDate } from "@/lib/date-display";

/**
 * Derive chart-friendly data arrays from the raw ReportSummary.
 *
 * Each chart type (pie, bar, line) gets its own memoized data array.
 * Returns empty arrays when data is unavailable so chart components
 * render nothing rather than erroring.
 */

/** Format an ISO week number + year as a human-readable date range. */
function formatWeekRange(week: number, year: number): string {
  const date = setISOWeek(new Date(year, 0, 1), week);
  const start = startOfISOWeek(date);
  const end = endOfISOWeek(date);
  return `${format(start, "MMM d")} – ${format(end, "MMM d")}`;
}

export function useReportCharts(summary?: ReportSummary) {
  const { _ } = useLingui();

  const pieData = useMemo(() => {
    if (!summary) return [];
    return [
      { name: _(msg`Check In`), value: summary.check_ins },
      { name: _(msg`Check Out`), value: summary.check_outs },
      { name: _(msg`Break Out`), value: summary.break_outs },
      { name: _(msg`Break In`), value: summary.break_ins },
      { name: _(msg`OT In`), value: summary.overtime_ins },
      { name: _(msg`OT Out`), value: summary.overtime_outs },
    ].filter((d) => d.value > 0);
  }, [summary, _]);

  const barData = useMemo(() => {
    if (!summary?.daily_breakdown) return [];
    return summary.daily_breakdown.map((d) => ({
      name: formatDate(d.date * 1000, "M/d/yyyy"),
      value: d.count,
    }));
  }, [summary]);

  const statusData = useMemo(() => {
    if (!summary?.status_distribution) return [];
    const labels: Record<string, string> = {
      full: _(msg`Full Day`),
      half: _(msg`Half Day`),
      absent: _(msg`Absent`),
    };
    return summary.status_distribution.map((d) => ({
      name: labels[d.status] ?? d.status,
      value: d.count,
    }));
  }, [summary, _]);

  const dailyHoursData = useMemo(() => {
    if (!summary?.daily_hours) return [];
    return summary.daily_hours.map((d) => ({
      date: formatDate(d.date * 1000, "MMM d"),
      regular: +(d.regular_seconds / 3600).toFixed(1),
      overtime: +(d.overtime_seconds / 3600).toFixed(1),
    }));
  }, [summary]);

  const weeklyHoursData = useMemo(() => {
    if (!summary?.weekly_hours) return [];
    return summary.weekly_hours.map((w) => {
      const label = formatWeekRange(w.week, w.year);
      return {
        week: label,
        weekNumber: w.week,
        hours: +(w.total_seconds / 3600).toFixed(1),
      };
    });
  }, [summary]);

  return { pieData, barData, statusData, dailyHoursData, weeklyHoursData };
}

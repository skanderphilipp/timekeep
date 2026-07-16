import { useMemo } from "react";
import { useLingui } from "@lingui/react";
import { msg } from "@lingui/core/macro";
import type { ReportSummary } from "@/lib/api";

/**
 * Derive chart-friendly data arrays from the raw ReportSummary.
 *
 * Each chart type (pie, bar, line) gets its own memoized data array.
 * Returns empty arrays when data is unavailable so chart components
 * render nothing rather than erroring.
 */
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
      name: new Date(d.date * 1000).toLocaleDateString(),
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
      date: new Date(d.date * 1000).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
      }),
      regular: +(d.regular_seconds / 3600).toFixed(1),
      overtime: +(d.overtime_seconds / 3600).toFixed(1),
    }));
  }, [summary]);

  const weeklyHoursData = useMemo(() => {
    if (!summary?.weekly_hours) return [];
    return summary.weekly_hours.map((w) => ({
      week: `${_(msg`W`)}${w.week}`,
      hours: +(w.total_seconds / 3600).toFixed(1),
    }));
  }, [summary, _]);

  return { pieData, barData, statusData, dailyHoursData, weeklyHoursData };
}

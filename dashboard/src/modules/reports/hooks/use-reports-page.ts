import { useMemo, useCallback } from "react";
import { useLingui } from "@lingui/react";
import { msg } from "@lingui/core/macro";

import { useFilterUrl } from "@/infrastructure/query-params";
import { useReportSummary } from "./use-report-summary";
import { fetchPunches } from "@/lib/api";
import type { ActiveFilter, DateRangePreset } from "@/components/ui";

const reportFilterDefaults = {
  date_from: "",
  date_to: "",
};

function isoToUnixStart(iso: string): number {
  if (!iso) return 0;
  return Math.floor(new Date(`${iso}T00:00:00Z`).getTime() / 1000);
}

function isoToUnixEnd(iso: string): number {
  if (!iso) return 0;
  return Math.floor(new Date(`${iso}T23:59:59Z`).getTime() / 1000);
}

/** Creates date range presets with fresh dates on every call. */
function useReportPresets() {
  const { _ } = useLingui();
  return useMemo<DateRangePreset[]>(() => [
    {
      key: "today",
      label: () => _(msg`Today`),
      getRange: () => {
        const now = new Date();
        const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        return { from: start, to: new Date(start.getTime() + 86_399_999) };
      },
    },
    {
      key: "thisWeek",
      label: () => _(msg`This Week`),
      getRange: () => {
        const now = new Date();
        const day = now.getDay();
        const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (day === 0 ? 6 : day - 1));
        return { from: monday, to: now };
      },
    },
    {
      key: "thisMonth",
      label: () => _(msg`This Month`),
      getRange: () => {
        const now = new Date();
        return {
          from: new Date(now.getFullYear(), now.getMonth(), 1),
          to: new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59),
        };
      },
    },
    {
      key: "lastMonth",
      label: () => _(msg`Last Month`),
      getRange: () => {
        const now = new Date();
        return {
          from: new Date(now.getFullYear(), now.getMonth() - 1, 1),
          to: new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59),
        };
      },
    },
  ], [_]);
}

export function useReportsPage() {
  const { _ } = useLingui();

  const {
    filters,
    setFilter,
    resetFilters,
    hasActiveFilters,
  } = useFilterUrl({
    namespace: "reports",
    defaults: reportFilterDefaults,
  });

  const presets = useReportPresets();

  const apiFilter = useMemo(() => {
    const f: { date_from?: number; date_to?: number } = {};
    if (filters.date_from) f.date_from = isoToUnixStart(filters.date_from);
    if (filters.date_to) f.date_to = isoToUnixEnd(filters.date_to);
    return f;
  }, [filters.date_from, filters.date_to]);

  const { data: summary, isLoading, error, refetch } = useReportSummary(apiFilter);

  const activeFilters: ActiveFilter[] = useMemo(() => {
    const result: ActiveFilter[] = [];
    if (filters.date_from) {
      result.push({ key: "date_from", label: `${_(msg`From`)} ${filters.date_from}`, onRemove: () => setFilter({ date_from: "" }) });
    }
    if (filters.date_to) {
      result.push({ key: "date_to", label: `${_(msg`To`)} ${filters.date_to}`, onRemove: () => setFilter({ date_to: "" }) });
    }
    return result;
  }, [filters, setFilter, _]);

  /** Chart data: punch type distribution pie */
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

  /** Chart data: daily punch volume */
  const barData = useMemo(() => {
    if (!summary?.daily_breakdown) return [];
    return summary.daily_breakdown.map((d) => ({
      name: new Date(d.date * 1000).toLocaleDateString(),
      value: d.count,
    }));
  }, [summary]);

  /** Status distribution donut data (full/half/absent) */
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

  const handleFetchPunches = useCallback(async () => {
    const result = await fetchPunches({
      since: filters.date_from || undefined,
      until: filters.date_to || undefined,
    });
    return result.punches;
  }, [filters.date_from, filters.date_to]);

  const exportFilter = useMemo(
    () => ({
      ...(filters.date_from && { since: filters.date_from }),
      ...(filters.date_to && { until: filters.date_to }),
    }),
    [filters.date_from, filters.date_to],
  );

  return {
    filters,
    setFilter,
    resetFilters,
    hasActiveFilters,
    presets,
    summary,
    isLoading,
    error,
    refetch,
    activeFilters,
    pieData,
    barData,
    statusData,
    handleFetchPunches,
    exportFilter,
  };
}

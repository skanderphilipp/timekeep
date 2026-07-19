import { useMemo, useCallback } from "react";
import { useAtomValue } from "jotai";
import { useLingui } from "@lingui/react";
import { msg } from "@lingui/core/macro";

import { useFilterUrl } from "@/infrastructure/query-params";
import { useReportSummary } from "./use-report-summary";
import { useReportPresets } from "./use-report-presets";
import { useReportCharts } from "./use-report-charts";
import { fetchPunches } from "@/lib/api";
import { clientConfigState } from "@/infrastructure/state";
import { APP_NAME } from "@/lib/constants";
import { toUnixStartOfDay, toUnixEndOfDay } from "@/lib/date";
import type { ActiveFilter } from "@/components/ui";

const reportFilterDefaults = { date_from: "", date_to: "" };

const PDF_CHART_SELECTORS = [
  '[data-pdf-chart="punch-type-distribution"]',
  '[data-pdf-chart="daily-punch-volume"]',
  '[data-pdf-chart="attendance-distribution"]',
  '[data-pdf-chart="weekly-hours"]',
  '[data-pdf-chart="daily-work-hours"]',
];

export function useReportsPage() {
  const { _ } = useLingui();
  const { filters, setFilter, resetFilters, hasActiveFilters } = useFilterUrl({
    namespace: "reports",
    defaults: reportFilterDefaults,
  });
  const presets = useReportPresets();

  const apiFilter = useMemo(() => {
    const f: { date_from?: number; date_to?: number } = {};
    if (filters.date_from) f.date_from = toUnixStartOfDay(filters.date_from);
    if (filters.date_to) f.date_to = toUnixEndOfDay(filters.date_to);
    return f;
  }, [filters.date_from, filters.date_to]);

  const { data: summary, isLoading, error, refetch } = useReportSummary(apiFilter);
  const charts = useReportCharts(summary);

  const activeFilters: ActiveFilter[] = useMemo(() => {
    const result: ActiveFilter[] = [];
    if (filters.date_from) {
      result.push({
        key: "date_from",
        label: `${_(msg`From`)} ${filters.date_from}`,
        onRemove: () => setFilter({ date_from: "" }),
      });
    }
    if (filters.date_to) {
      result.push({
        key: "date_to",
        label: `${_(msg`To`)} ${filters.date_to}`,
        onRemove: () => setFilter({ date_to: "" }),
      });
    }
    return result;
  }, [filters, setFilter, _]);

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

  const clientConfig = useAtomValue(clientConfigState.atom);
  const workspaceName = clientConfig?.workspace_name || APP_NAME;

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
    ...charts,
    handleFetchPunches,
    exportFilter,
    workspaceName,
    chartSelectors: PDF_CHART_SELECTORS,
  };
}

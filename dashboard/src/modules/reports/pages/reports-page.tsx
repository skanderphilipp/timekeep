import { useMemo, useCallback } from "react";
import { useLingui } from "@lingui/react";
import { msg } from "@lingui/core/macro";

import {
  PageLayout,
  PageBody,
  PageHeader,
  Section,
  Chart,
  PieChart,
  BarChart,
  FilterBar,
  DatePicker,
  Spinner,
  EmptyState,
  Callout,
  Grid,
} from "@/components/ui";
import type { ActiveFilter } from "@/components/ui/filter-bar";
import type { DateRangePreset } from "@/components/ui/date-picker";
import { fromDateString, toDateString } from "@/lib/date";
import { useFilterUrl } from "@/infrastructure/query-params";
import { useReportSummary } from "../hooks/use-report-summary";
import { fetchPunches } from "@/lib/api";
import { ExportBar } from "@/modules/exports";
import { ReportSummaryCards } from "../components/report-summary-cards";

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

export function ReportsPage() {
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

  /** Presets that compute fresh dates on every call, avoiding stale closures. */
  const presets: DateRangePreset[] = [
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
      key: "last7",
      label: () => _(msg`Last 7 days`),
      getRange: () => {
        const now = new Date();
        const end = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        return { from: new Date(end.getTime() - 6 * 86_400_000), to: end };
      },
    },
    {
      key: "last30",
      label: () => _(msg`Last 30 days`),
      getRange: () => {
        const now = new Date();
        const end = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        return { from: new Date(end.getTime() - 29 * 86_400_000), to: end };
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
  ];

  const apiFilter = useMemo(() => {
    const f: { date_from?: number; date_to?: number } = {};
    if (filters.date_from) f.date_from = isoToUnixStart(filters.date_from);
    if (filters.date_to) f.date_to = isoToUnixEnd(filters.date_to);
    return f;
  }, [filters.date_from, filters.date_to]);

  const { data: summary, isLoading, error } = useReportSummary(apiFilter);

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

  if (isLoading) {
    return (
      <PageLayout>
        <PageBody>
          <PageHeader title={_(msg`Reports`)} />
          <Section>
            <Spinner />
          </Section>
        </PageBody>
      </PageLayout>
    );
  }

  if (error) {
    return (
      <PageLayout>
        <PageBody>
          <PageHeader title={_(msg`Reports`)} />
          <Section>
            <Callout
              variant="error"
              title={_(msg`Error`)}
              description={_(msg`Failed to load report data. Is the backend running?`)}
            />
          </Section>
        </PageBody>
      </PageLayout>
    );
  }

  return (
    <PageLayout>
      <PageBody>
        <PageHeader
          title={_(msg`Reports`)}
          description={_(msg`Attendance statistics, punch distribution, and exports.`)}
        />

        {summary && (
          <Section>
            <ReportSummaryCards summary={summary} />
          </Section>
        )}

        <Section>
          <FilterBar
            onClear={resetFilters}
            hasActiveFilters={hasActiveFilters}
            activeFilters={activeFilters}
          >
            <DatePicker
              mode="range"
              value={filters.date_from ? fromDateString(filters.date_from) : null}
              endValue={filters.date_to ? fromDateString(filters.date_to) : null}
              onChange={(from, to) => {
                setFilter({
                  date_from: from ? toDateString(from) : "",
                  date_to: to ? toDateString(to) : "",
                });
              }}
              placeholder={_(msg`Select date range…`)}
              presets={presets}
            />
          </FilterBar>
        </Section>

        <Section>
          <Grid cols={2}>
            {pieData.length > 0 ? (
              <Chart
                title={_(msg`Punch Type Distribution`)}
                description={_(msg`Breakdown of attendance events by type.`)}
                height={320}
              >
                <PieChart data={pieData} donut showLegend />
              </Chart>
            ) : (
              <EmptyState
                title={_(msg`No data`)}
                description={_(msg`No punch records found for the selected date range.`)}
              />
            )}

            {barData.length > 0 && (
              <Chart
                title={_(msg`Daily Punch Volume`)}
                description={_(msg`Number of punches per day in the selected range.`)}
                height={320}
              >
                <BarChart
                  data={barData}
                  bars={[{ dataKey: "value", fill: "var(--ao-accent-accent9)" }]}
                  xKey="name"
                />
              </Chart>
            )}
          </Grid>
        </Section>

        <Section>
          <ExportBar
            filter={exportFilter}
            summary={summary ?? undefined}
            dateFrom={filters.date_from || undefined}
            dateTo={filters.date_to || undefined}
            onFetchPunches={handleFetchPunches}
          />
        </Section>
      </PageBody>
    </PageLayout>
  );
}

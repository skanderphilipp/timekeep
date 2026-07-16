import { useLingui } from "@lingui/react";
import { msg } from "@lingui/core/macro";

import { Section, Chart, PieChart, BarChart, LineChart, FilterBar, DatePicker, EmptyState, Grid } from "@/components/ui";
import { PageHeader } from "@/components/layout";
import { DataBoundary } from "@/modules/shared/components";
import { fromDateString, toDateString } from "@/lib/date";
import { useReportsPage } from "../hooks/use-reports-page";
// oxlint-disable-next-line bentech/no-cross-module-imports -- pre-existing; exports bar is a shared utility consumed by reports
import { ExportBar } from "@/modules/exports";
import { ReportSummaryCards } from "./report-summary-cards";
import { EmployeeKpiTable } from "./employee-kpi-table";
import { ReportLoading, ReportError, ReportEmpty } from "../states";
import type { ReportSummary } from "@/lib/api";

/**
 * Reports view — summary cards, date filter, distribution charts, exports.
 *
 * Chart sections use data-pdf-chart attributes on wrapper elements so the
 * PDF export can query and capture chart SVGs as embedded images. These
 * wrappers are functional (not visual) and intentionally bypass the
 * no-raw-html-elements rule.
 */

/* oxlint-disable bentech/no-raw-html-elements -- functional wrappers for PDF chart capture */

export function ReportsView() {
  const { _ } = useLingui();
  const page = useReportsPage();

  return (
    <>
      <PageHeader
        title={_(msg`Reports`)}
        description={_(msg`Attendance statistics, punch distribution, and exports.`)}
      />

      <Section>
        <FilterBar
          onClear={page.resetFilters}
          hasActiveFilters={page.hasActiveFilters}
          activeFilters={page.activeFilters}
        >
          <DatePicker
            mode="range"
            value={page.filters.date_from ? fromDateString(page.filters.date_from) : null}
            endValue={page.filters.date_to ? fromDateString(page.filters.date_to) : null}
            onChange={(from, to) => {
              page.setFilter({
                date_from: from ? toDateString(from) : "",
                date_to: to ? toDateString(to) : "",
              });
            }}
            placeholder={_(msg`Select date range…`)}
            presets={page.presets}
          />
        </FilterBar>
      </Section>

      <DataBoundary<ReportSummary>
        data={page.summary ? [page.summary] : undefined}
        isLoading={page.isLoading}
        error={page.error ?? null}
        onRetry={() => page.refetch()}
        loadingFallback={<ReportLoading />}
        errorFallback={<ReportError onRetry={() => page.refetch()} />}
        emptyFallback={<ReportEmpty />}
      >
        {([summary]) => (
          <>
            <Section>
              <ReportSummaryCards summary={summary} />
            </Section>

            <Section>
              <Grid cols={2}>
                {page.pieData.length > 0 ? (
                  <div
                    data-pdf-chart="punch-type-distribution"
                    data-pdf-chart-title={_(msg`Punch Type Distribution`)}
                    data-pdf-chart-description={_(msg`Breakdown of attendance events by type.`)}
                  >
                    <Chart
                      title={_(msg`Punch Type Distribution`)}
                      description={_(msg`Breakdown of attendance events by type.`)}
                    >
                      <PieChart data={page.pieData} donut showLegend height={320} />
                    </Chart>
                  </div>
                ) : (
                  <EmptyState
                    title={_(msg`No data`)}
                    description={_(msg`No punch records found for the selected date range.`)}
                  />
                )}

                {page.barData.length > 0 && (
                  <div
                    data-pdf-chart="daily-punch-volume"
                    data-pdf-chart-title={_(msg`Daily Punch Volume`)}
                    data-pdf-chart-description={_(msg`Number of punches per day in the selected range.`)}
                  >
                    <Chart
                      title={_(msg`Daily Punch Volume`)}
                      description={_(msg`Number of punches per day in the selected range.`)}
                    >
                      <BarChart
                        data={page.barData}
                        bars={[{ dataKey: "value" }]}
                        xKey="name"
                        height={320}
                      />
                    </Chart>
                  </div>
                )}
              </Grid>
            </Section>

            {(page.statusData.length > 0 || page.weeklyHoursData.length > 0) && (
              <Section>
                <Grid cols={2}>
                  {page.statusData.length > 0 ? (
                    <div
                      data-pdf-chart="attendance-distribution"
                      data-pdf-chart-title={_(msg`Attendance Distribution`)}
                      data-pdf-chart-description={_(msg`Full day, half day, and absent breakdown.`)}
                    >
                      <Chart
                        title={_(msg`Attendance Distribution`)}
                        description={_(msg`Full day, half day, and absent breakdown.`)}
                      >
                        <PieChart data={page.statusData} height={320} />
                      </Chart>
                    </div>
                  ) : (
                    <EmptyState
                      title={_(msg`No distribution data`)}
                      description={_(msg`No status distribution available for the selected range.`)}
                    />
                  )}

                  {page.weeklyHoursData.length > 0 ? (
                    <div
                      data-pdf-chart="weekly-hours"
                      data-pdf-chart-title={_(msg`Weekly Hours`)}
                      data-pdf-chart-description={_(msg`Total hours worked per week.`)}
                    >
                      <Chart
                        title={_(msg`Weekly Hours`)}
                        description={_(msg`Total hours worked per week.`)}
                      >
                        <LineChart
                          data={page.weeklyHoursData}
                          lines={[{ dataKey: "hours", name: _(msg`Hours`), dot: true }]}
                          xKey="week"
                          grid
                          height={320}
                        />
                      </Chart>
                    </div>
                  ) : (
                    <EmptyState
                      title={_(msg`No weekly data`)}
                      description={_(msg`No weekly breakdown available for the selected range.`)}
                    />
                  )}
                </Grid>
              </Section>
            )}

            {page.dailyHoursData.length > 0 && (
              <Section>
                <div
                  data-pdf-chart="daily-work-hours"
                  data-pdf-chart-title={_(msg`Daily Work Hours`)}
                  data-pdf-chart-description={_(msg`Regular and overtime hours per day.`)}
                >
                  <Chart
                    title={_(msg`Daily Work Hours`)}
                    description={_(msg`Regular and overtime hours per day.`)}
                  >
                    <LineChart
                      data={page.dailyHoursData}
                      lines={[
                        {
                          dataKey: "regular",
                          name: _(msg`Regular`),
                          stroke: "var(--ao-accent-accent9)",
                          areaFill: 0.15,
                        },
                        {
                          dataKey: "overtime",
                          name: _(msg`Overtime`),
                          stroke: "var(--ao-color-amber9)",
                          areaFill: 0.15,
                        },
                      ]}
                      xKey="date"
                      grid
                      height={320}
                    />
                  </Chart>
                </div>
              </Section>
            )}

            {summary.employees && summary.employees.length > 0 && (
              <Section>
                <EmployeeKpiTable data={summary.employees} />
              </Section>
            )}

            <Section>
              <ExportBar
                filter={page.exportFilter}
                summary={summary}
                dateFrom={page.filters.date_from || undefined}
                dateTo={page.filters.date_to || undefined}
                onFetchPunches={page.handleFetchPunches}
                workspaceName={page.workspaceName}
                employeeKpis={summary.employees}
                chartSelectors={page.chartSelectors}
              />
            </Section>
          </>
        )}
      </DataBoundary>
    </>
  );
}

/* oxlint-enable bentech/no-raw-html-elements */

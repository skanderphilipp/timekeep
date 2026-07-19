import { useLingui } from "@lingui/react";
import { msg } from "@lingui/core/macro";

import { Section, FilterBar, DatePicker, EmptyState, Grid } from "@/components/ui";
import { PageHeader } from "@/components/layout";
import { DataBoundary } from "@/modules/shared/components";
import { fromDateString, toDateString } from "@/lib/date";
import { useReportsPage } from "../hooks/use-reports-page";
// oxlint-disable-next-line bentech/no-cross-module-imports -- pre-existing; exports bar is a shared utility consumed by reports
import { ExportBar } from "@/modules/exports";
import { ReportSummaryCards } from "./report-summary-cards";
import { EmployeeKpiTable } from "./employee-kpi-table";
import { PunchTypeDistributionChart } from "./punch-type-distribution-chart";
import { DailyPunchVolumeChart } from "./daily-punch-volume-chart";
import { AttendanceDistributionChart } from "./attendance-distribution-chart";
import { WeeklyHoursChart } from "./weekly-hours-chart";
import { DailyWorkHoursChart } from "./daily-work-hours-chart";
import { ReportLoading, ReportError, ReportEmpty } from "../states";
import type { ReportSummary } from "@/lib/api";

/**
 * Reports view — thin composite that orchestrates the reports page.
 *
 * Delegates each chart section to a focused sub-component.
 * All business logic lives in useReportsPage().
 */
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

            {/* Row 1: Punch distribution + daily volume */}
            <Section>
              <Grid cols={2}>
                {page.pieData.length > 0 ? (
                  <PunchTypeDistributionChart data={page.pieData} />
                ) : (
                  <EmptyState
                    title={_(msg`No data`)}
                    description={_(msg`No punch records found for the selected date range.`)}
                  />
                )}

                {page.barData.length > 0 && (
                  <DailyPunchVolumeChart data={page.barData} />
                )}
              </Grid>
            </Section>

            {/* Row 2: Attendance distribution + weekly hours */}
            {(page.statusData.length > 0 || page.weeklyHoursData.length > 0) && (
              <Section>
                <Grid cols={2}>
                  {page.statusData.length > 0 ? (
                    <AttendanceDistributionChart data={page.statusData} />
                  ) : (
                    <EmptyState
                      title={_(msg`No distribution data`)}
                      description={_(msg`No status distribution available for the selected range.`)}
                    />
                  )}

                  {page.weeklyHoursData.length > 0 && (
                    <WeeklyHoursChart data={page.weeklyHoursData} />
                  )}
                </Grid>
              </Section>
            )}

            {/* Row 3: Daily work hours (full-width) */}
            {page.dailyHoursData.length > 0 && (
              <Section>
                <DailyWorkHoursChart data={page.dailyHoursData} />
              </Section>
            )}

            {/* Employee KPI table */}
            {summary.employees && summary.employees.length > 0 && (
              <Section>
                <EmployeeKpiTable data={summary.employees} />
              </Section>
            )}

            {/* Export bar */}
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

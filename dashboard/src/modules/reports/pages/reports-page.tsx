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
  Grid,
  PageError,
} from "@/components/ui";
import { fromDateString, toDateString } from "@/lib/date";
import { useReportsPage } from "../hooks/use-reports-page";
import { ExportBar } from "@/modules/exports";
import { ReportSummaryCards } from "../components/report-summary-cards";

export function ReportsPage() {
  const { _ } = useLingui();
  const page = useReportsPage();

  if (page.isLoading) {
    return (
      <PageLayout>
        <PageBody>
          <PageHeader title={_(msg`Reports`)} />
          <Section><Spinner /></Section>
        </PageBody>
      </PageLayout>
    );
  }

  if (page.error) {
    return (
      <PageLayout>
        <PageBody>
          <PageHeader
            title={_(msg`Reports`)}
            description={_(msg`Attendance statistics, punch distribution, and exports.`)}
          />
          <PageError onRetry={() => page.refetch()} />
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

        {page.summary && (
          <Section>
            <ReportSummaryCards summary={page.summary} />
          </Section>
        )}

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

        <Section>
          <Grid cols={2}>
            {page.pieData.length > 0 ? (
              <Chart
                title={_(msg`Punch Type Distribution`)}
                description={_(msg`Breakdown of attendance events by type.`)}
              >
                <PieChart data={page.pieData} donut showLegend height={320} />
              </Chart>
            ) : (
              <EmptyState
                title={_(msg`No data`)}
                description={_(msg`No punch records found for the selected date range.`)}
              />
            )}

            {page.barData.length > 0 && (
              <Chart
                title={_(msg`Daily Punch Volume`)}
                description={_(msg`Number of punches per day in the selected range.`)}
              >
                <BarChart
                  data={page.barData}
                  bars={[{ dataKey: "value", fill: "var(--ao-accent-accent9)" }]}
                  xKey="name"
                  height={320}
                />
              </Chart>
            )}
          </Grid>
        </Section>

        <Section>
          <ExportBar
            filter={page.exportFilter}
            summary={page.summary ?? undefined}
            dateFrom={page.filters.date_from || undefined}
            dateTo={page.filters.date_to || undefined}
            onFetchPunches={page.handleFetchPunches}
          />
        </Section>
      </PageBody>
    </PageLayout>
  );
}

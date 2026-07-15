import { Section, Grid, IconButton } from "@/components/ui";
import { PageLayout, PageBody, PageBar } from "@/components/layout";
import { DataBoundary } from "@/modules/shared/components";
import { IconRefresh } from "@tabler/icons-react";
import { msg } from "@lingui/core/macro";
import { useLingui } from "@lingui/react";

import { useDashboardPage } from "../hooks/use-dashboard-page";
import { DashboardMetrics } from "../components/dashboard-metrics";
import { CheckedInList } from "../components/checked-in-list";
import { DashboardActivityFeed } from "../components/dashboard-activity-feed";
import { DashboardDeviceStatus } from "../components/dashboard-device-status";
import { HourlyArrivalsChart } from "../components/attendance-chart";
import { DashboardSkeleton } from "../states";
import type { TodaySummary } from "@/lib/api";

/** TODO(ENTERPRISE): Extract fmt into shared time formatting utility under @/lib. */
function fmt(s: number | null, _: ReturnType<typeof useLingui>["_"]): string {
  if (s === null) return "";
  if (s < 30) return _(msg`Updated just now`);
  if (s < 60) return _(msg`Updated ${s}s ago`);
  const m = Math.floor(s / 60);
  return s < 3600 ? _(msg`Updated ${m}m ago`) : _(msg`Updated ${Math.floor(s / 3600)}h ago`);
}
export function DashboardPage() {
  const page = useDashboardPage();
  const { _ } = useLingui();
  const desc = _(msg`Attendance overview and device status.`)
    + (page.secondsSinceUpdate != null ? " " + fmt(page.secondsSinceUpdate, _) : "");
  return (
    <PageLayout>
      <PageBar
        title={_(msg`Dashboard`)}
        description={desc}
        actions={
          <IconButton onClick={page.handleRefresh}
            aria-label={_(msg`Refresh dashboard`)} title={_(msg`Refresh`)}>
            <IconRefresh size={16} />
          </IconButton>
        }
      />
      <PageBody>
        <DataBoundary<TodaySummary>
          data={page.data ? [page.data] : undefined}
          isLoading={page.isLoading}
          error={page.error}
          onRetry={page.handleRefresh}
          loadingFallback={<DashboardSkeleton />}
        >
          {([data]) => (
            <>
              <Section><DashboardMetrics data={data} /></Section>

              {data.currently_checked_in && (
                <Section>
                  <CheckedInList employees={data.currently_checked_in} onUserClick={page.handleUserClick} />
                </Section>
              )}

              <Section>
                <Grid cols={2}>
                  <HourlyArrivalsChart
                    hourlyBreakdown={data.hourly_breakdown}
                    isLoading={page.isFetching && !data.hourly_breakdown}
                    error={null}
                  />
                  <DashboardActivityFeed events={data.recent_events} />
                </Grid>
              </Section>

              {data.device_health && data.device_health.length > 0 && (
                <Section>
                  <DashboardDeviceStatus devices={data.device_health} onDeviceClick={page.handleDeviceClick} />
                </Section>
              )}
            </>
          )}
        </DataBoundary>
      </PageBody>
    </PageLayout>
  );
}

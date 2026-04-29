import {
  PageLayout,
  PageBody,
  Section,
  Skeleton,
  Grid,
  CardGrid,
  Card,
} from "@/components/ui";

import { useDashboardPage } from "../hooks/use-dashboard-page";
import { DashboardMetrics } from "../components/dashboard-metrics";
import { CheckedInList } from "../components/checked-in-list";
import { DashboardActivityFeed } from "../components/dashboard-activity-feed";
import { DashboardDeviceStatus } from "../components/dashboard-device-status";
import { HourlyArrivalsChart } from "../components/attendance-chart";
import { DashboardError } from "../components/dashboard-error";
import { DashboardHeaderActions } from "../components/dashboard-header-actions";

/** Card-shaped loading skeleton — matches metric card dimensions. */
function DashboardSkeleton() {
  return (
    <>
      <Section>
        <CardGrid>
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <Card.Content>
                <Skeleton variant="rect" width="100%" height={96} />
              </Card.Content>
            </Card>
          ))}
        </CardGrid>
      </Section>
      <Section>
        <Skeleton variant="rect" width="100%" height={200} />
      </Section>
      <Section>
        <Skeleton variant="rect" width="100%" height={200} />
      </Section>
    </>
  );
}

export function DashboardPage() {
  const page = useDashboardPage();

  return (
    <PageLayout>
      <DashboardHeaderActions
        secondsSinceUpdate={page.secondsSinceUpdate}
        onRefresh={page.handleRefresh}
      />

      <PageBody>
        {page.isLoading && !page.data && <DashboardSkeleton />}

        {page.error && !page.data && (
          <DashboardError onRetry={page.handleRefresh} />
        )}

        {page.data && (
          <>
            <Section>
              <DashboardMetrics data={page.data} />
            </Section>

            {page.data.currently_checked_in && (
              <Section>
                <CheckedInList employees={page.data.currently_checked_in} onUserClick={page.handleUserClick} />
              </Section>
            )}

            <Section>
              <Grid cols={2}>
                <HourlyArrivalsChart
                  hourlyBreakdown={page.data.hourly_breakdown}
                  isLoading={page.isFetching && !page.data.hourly_breakdown}
                  error={null}
                />

                <DashboardActivityFeed
                  events={page.data.recent_events}
                />
              </Grid>
            </Section>

            {page.data.device_health && page.data.device_health.length > 0 && (
              <Section>
                <DashboardDeviceStatus
                  devices={page.data.device_health}
                  onDeviceClick={page.handleDeviceClick}
                />
              </Section>
            )}
          </>
        )}
      </PageBody>
    </PageLayout>
  );
}

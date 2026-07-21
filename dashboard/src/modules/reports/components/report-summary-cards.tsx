import { useLingui } from "@lingui/react";
import { msg } from "@lingui/core/macro";
import { IconCalendar, IconClock, IconClockPlus, IconPercentage } from "@tabler/icons-react";

import { StatCard, Grid } from "@/components/ui";
import type { ReportSummary } from "@/lib/api";
import { formatDurationSeconds } from "@/lib/format-duration";

type ReportSummaryCardsProps = {
  summary: ReportSummary;
};

/**
 * Report KPI cards — uses StatCard (horizontal layout) for consistent design.
 *
 * Shows the four business KPIs: Work Days, Avg Hours, Overtime, Absence Rate.
 */
export function ReportSummaryCards({ summary }: ReportSummaryCardsProps) {
  const { _ } = useLingui();

  return (
    <Grid>
      <StatCard
        dataSlot="stat-card-work-days"
        layout="horizontal"
        icon={<IconCalendar size={20} />}
        label={_(msg`Work Days`)}
        value={summary.work_days ?? 0}
        subtitle={_(msg`this period`)}
        color="accent"
      />
      <StatCard
        dataSlot="stat-card-avg-hours"
        layout="horizontal"
        icon={<IconClock size={20} />}
        label={_(msg`Avg Hours`)}
        value={formatDurationSeconds(summary.avg_seconds_per_day ?? 0)}
        subtitle={_(msg`per day`)}
        color="accent"
      />
      <StatCard
        dataSlot="stat-card-overtime"
        layout="horizontal"
        icon={<IconClockPlus size={20} />}
        label={_(msg`Overtime`)}
        value={formatDurationSeconds(summary.overtime_seconds ?? 0)}
        subtitle={_(msg`total`)}
        color="amber"
      />
      <StatCard
        dataSlot="stat-card-absence-rate"
        layout="horizontal"
        icon={<IconPercentage size={20} />}
        label={_(msg`Absence Rate`)}
        value={`${(summary.absence_rate ?? 0).toFixed(1)}%`}
        subtitle={_(msg`this period`)}
        color="red"
      />
    </Grid>
  );
}

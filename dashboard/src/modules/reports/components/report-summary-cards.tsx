import { useLingui } from "@lingui/react";
import { msg } from "@lingui/core/macro";
import { IconCalendar, IconClock, IconClockPlus, IconPercentage } from "@tabler/icons-react";

import { MetricCard, CardGrid } from "@/components/ui";
import type { ReportSummary } from "@/lib/api";

/** Format seconds into a human-readable duration string. */
function formatHours(seconds: number): string {
  const hours = seconds / 3600;
  if (hours < 1) return `${Math.round(seconds / 60)}m`;
  return `${hours.toFixed(1)}h`;
}

type ReportSummaryCardsProps = {
  summary: ReportSummary;
};

/**
 * Report KPI cards — matches the Dashboard's MetricCard pattern.
 *
 * Shows the four business KPIs from the spec:
 * Work Days, Avg Hours, Overtime, Absence Rate.
 */
export function ReportSummaryCards({ summary }: ReportSummaryCardsProps) {
  const { _ } = useLingui();

  return (
    <CardGrid>
      <MetricCard
        icon={<IconCalendar size={24} />}
        label={_(msg`Work Days`)}
        value={summary.work_days ?? 0}
        sub={_(msg`this period`)}
        color="accent"
      />
      <MetricCard
        icon={<IconClock size={24} />}
        label={_(msg`Avg Hours`)}
        value={formatHours(summary.avg_seconds_per_day ?? 0)}
        sub={_(msg`per day`)}
        color="accent"
      />
      <MetricCard
        icon={<IconClockPlus size={24} />}
        label={_(msg`Overtime`)}
        value={formatHours(summary.overtime_seconds ?? 0)}
        sub={_(msg`total`)}
        color="amber"
      />
      <MetricCard
        icon={<IconPercentage size={24} />}
        label={_(msg`Absence Rate`)}
        value={`${(summary.absence_rate ?? 0).toFixed(1)}%`}
        sub={_(msg`this period`)}
        color="red"
      />
    </CardGrid>
  );
}

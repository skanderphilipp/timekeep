import { useLingui } from "@lingui/react";
import { msg } from "@lingui/core/macro";
import { IconUsers, IconUserX, IconClockExclamation, IconClockCheck } from "@tabler/icons-react";

import { MetricCard, CardGrid } from "@/components/ui";
import type { TodaySummary } from "@/lib/api";

type DashboardMetricsProps = {
  data: TodaySummary;
};

export function DashboardMetrics({ data }: DashboardMetricsProps) {
  const { _ } = useLingui();

  return (
    <CardGrid>
      <MetricCard
        icon={<IconUsers size={24} />}
        label={_(msg`Present`)}
        value={data.present}
        sub={_(msg`of ${data.total_employees}`)}
        color="green"
      />
      <MetricCard
        icon={<IconUserX size={24} />}
        label={_(msg`Absent`)}
        value={data.absent}
        sub={_(msg`of ${data.total_employees}`)}
        color="red"
      />
      <MetricCard
        icon={<IconClockExclamation size={24} />}
        label={_(msg`Late`)}
        value={data.late}
        sub={_(msg`today`)}
        color="amber"
      />
      <MetricCard
        icon={<IconClockCheck size={24} />}
        label={_(msg`On Time`)}
        value={data.on_time}
        sub={_(msg`today`)}
        color="green"
      />
    </CardGrid>
  );
}

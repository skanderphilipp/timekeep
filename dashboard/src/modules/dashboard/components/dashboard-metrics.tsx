import { useLingui } from "@lingui/react";
import { msg } from "@lingui/core/macro";
import { IconUsers, IconUserX, IconClockExclamation, IconClockCheck } from "@tabler/icons-react";

import { StatCard, Grid } from "@/components/ui";
import type { TodaySummary } from "@/lib/api";

type DashboardMetricsProps = {
  data: TodaySummary;
};

export function DashboardMetrics({ data }: DashboardMetricsProps) {
  const { _ } = useLingui();

  return (
    <Grid>
      <StatCard
        layout="horizontal"
        icon={<IconUsers size={20} />}
        label={_(msg`Present`)}
        value={data.present}
        subtitle={_(msg`of ${data.total_employees}`)}
        color="green"
      />
      <StatCard
        layout="horizontal"
        icon={<IconUserX size={20} />}
        label={_(msg`Absent`)}
        value={data.absent}
        subtitle={_(msg`of ${data.total_employees}`)}
        color="red"
      />
      <StatCard
        layout="horizontal"
        icon={<IconClockExclamation size={20} />}
        label={_(msg`Late`)}
        value={data.late}
        subtitle={_(msg`today`)}
        color="amber"
      />
      <StatCard
        layout="horizontal"
        icon={<IconClockCheck size={20} />}
        label={_(msg`On Time`)}
        value={data.on_time}
        subtitle={_(msg`today`)}
        color="green"
      />
    </Grid>
  );
}

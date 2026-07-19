import { useLingui } from "@lingui/react";
import { msg } from "@lingui/core/macro";

import { Chart, LineChart, ChartTooltip } from "@/components/ui";
import type { LinePointTooltipData } from "@/components/ui";
import { PdfChartCapture } from "./pdf-chart-capture";

type DailyWorkHoursChartProps = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: Record<string, any>[];
};

export function DailyWorkHoursChart({ data }: DailyWorkHoursChartProps) {
  const { _ } = useLingui();

  if (data.length === 0) return null;

  return (
    <PdfChartCapture
      id="daily-work-hours"
      title={_(msg`Daily Work Hours`)}
      description={_(msg`Regular and overtime hours per day.`)}
    >
      <Chart
        title={_(msg`Daily Work Hours`)}
        description={_(msg`Regular and overtime hours per day.`)}
      >
        <LineChart
          data={data}
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
          yLabel={_(msg`Hours`)}
          grid
          height={320}
          tooltip={(p: LinePointTooltipData) => (
            <ChartTooltip
              label={String(p.x)}
              value={`${p.name ?? p.dataKey}: ${p.y.toFixed(1)}h`}
            />
          )}
        />
      </Chart>
    </PdfChartCapture>
  );
}

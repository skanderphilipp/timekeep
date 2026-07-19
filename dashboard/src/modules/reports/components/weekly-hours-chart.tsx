import { useLingui } from "@lingui/react";
import { msg } from "@lingui/core/macro";

import { Chart, LineChart, ChartTooltip } from "@/components/ui";
import type { LinePointTooltipData } from "@/components/ui";
import { PdfChartCapture } from "./pdf-chart-capture";

type WeeklyHoursChartProps = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: Record<string, any>[];
};

export function WeeklyHoursChart({ data }: WeeklyHoursChartProps) {
  const { _ } = useLingui();

  if (data.length === 0) return null;

  return (
    <PdfChartCapture
      id="weekly-hours"
      title={_(msg`Weekly Hours`)}
      description={_(msg`Total hours worked per week.`)}
    >
      <Chart
        title={_(msg`Weekly Hours`)}
        description={_(msg`Total hours worked per week.`)}
      >
        <LineChart
          data={data}
          lines={[{ dataKey: "hours", name: _(msg`Hours`), dot: true }]}
          xKey="week"
          yLabel={_(msg`Hours`)}
          grid
          height={320}
          tooltip={(p: LinePointTooltipData) => (
            <ChartTooltip
              label={String(p.x)}
              value={`${p.y.toFixed(1)}h`}
            />
          )}
        />
      </Chart>
    </PdfChartCapture>
  );
}

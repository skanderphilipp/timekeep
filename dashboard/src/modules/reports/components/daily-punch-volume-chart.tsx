import { useLingui } from "@lingui/react";
import { msg } from "@lingui/core/macro";

import { Chart, BarChart, ChartTooltip } from "@/components/ui";
import type { BarTooltipData } from "@/components/ui";
import { PdfChartCapture } from "./pdf-chart-capture";

type DailyPunchVolumeChartProps = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: Record<string, any>[];
};

export function DailyPunchVolumeChart({ data }: DailyPunchVolumeChartProps) {
  const { _ } = useLingui();

  if (data.length === 0) return null;

  return (
    <PdfChartCapture
      id="daily-punch-volume"
      title={_(msg`Daily Punch Volume`)}
      description={_(msg`Number of punches per day in the selected range.`)}
    >
      <Chart
        title={_(msg`Daily Punch Volume`)}
        description={_(msg`Number of punches per day in the selected range.`)}
      >
        <BarChart
          data={data}
          bars={[{ dataKey: "value" }]}
          xKey="name"
          yLabel={_(msg`Punches`)}
          height={320}
          tooltip={(b: BarTooltipData) => (
            <ChartTooltip
              label={b.label}
              value={`${b.value} ${_(msg`punches`)}`}
            />
          )}
        />
      </Chart>
    </PdfChartCapture>
  );
}

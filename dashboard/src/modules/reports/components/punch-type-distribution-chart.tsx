import { useLingui } from "@lingui/react";
import { msg } from "@lingui/core/macro";

import { Chart, PieChart, ChartTooltip } from "@/components/ui";
import type { PieSliceTooltipData } from "@/components/ui";
import { PdfChartCapture } from "./pdf-chart-capture";
import type { SliceDef } from "@/components/ui";

type PunchTypeDistributionChartProps = {
  data: SliceDef[];
};

export function PunchTypeDistributionChart({ data }: PunchTypeDistributionChartProps) {
  const { _ } = useLingui();

  if (data.length === 0) return null;

  return (
    <PdfChartCapture
      id="punch-type-distribution"
      title={_(msg`Punch Type Distribution`)}
      description={_(msg`Breakdown of attendance events by type.`)}
    >
      <Chart
        title={_(msg`Punch Type Distribution`)}
        description={_(msg`Breakdown of attendance events by type.`)}
      >
        <PieChart
          data={data}
          donut
          showLegend
          showLabels
          height={320}
          tooltip={(s: PieSliceTooltipData) => (
            <ChartTooltip
              label={s.name}
              value={`${s.value} ${_(msg`punches`)}`}
              secondary={`${s.percentage.toFixed(1)}%`}
            />
          )}
        />
      </Chart>
    </PdfChartCapture>
  );
}

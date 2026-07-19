import { useLingui } from "@lingui/react";
import { msg } from "@lingui/core/macro";

import { Chart, PieChart, ChartTooltip } from "@/components/ui";
import type { PieSliceTooltipData } from "@/components/ui";
import { PdfChartCapture } from "./pdf-chart-capture";
import type { SliceDef } from "@/components/ui";

type AttendanceDistributionChartProps = {
  data: SliceDef[];
};

export function AttendanceDistributionChart({ data }: AttendanceDistributionChartProps) {
  const { _ } = useLingui();

  if (data.length === 0) return null;

  return (
    <PdfChartCapture
      id="attendance-distribution"
      title={_(msg`Attendance Distribution`)}
      description={_(msg`Full day, half day, and absent breakdown.`)}
    >
      <Chart
        title={_(msg`Attendance Distribution`)}
        description={_(msg`Full day, half day, and absent breakdown.`)}
      >
        <PieChart
          data={data}
          showLabels
          height={320}
          tooltip={(s: PieSliceTooltipData) => (
            <ChartTooltip
              label={s.name}
              value={`${s.value} ${_(msg`employee-days`)}`}
              secondary={`${s.percentage.toFixed(1)}%`}
            />
          )}
        />
      </Chart>
    </PdfChartCapture>
  );
}

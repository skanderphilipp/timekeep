import { ResponsivePie } from "@nivo/pie";

import { nivoTheme } from "./nivo-theme";

export type SliceDef = {
  name: string;
  value: number;
  color?: string;
};

export type PieChartProps = {
  data: SliceDef[];
  height?: number;
  donut?: boolean;
  showLegend?: boolean;
};

const DEFAULT_COLORS = [
  "var(--ao-accent-accent9)",
  "var(--ao-color-green9)",
  "var(--ao-color-amber9)",
  "var(--ao-color-red9)",
  "var(--ao-color-blue9)",
  "var(--ao-accent-accent7)",
  "var(--ao-color-green7)",
];

export function PieChart({ data, height = 250, donut = false, showLegend = true }: PieChartProps) {
  if (data.length === 0) return null;

  const nivoData = data.map((d, i) => ({
    id: d.name,
    label: d.name,
    value: d.value,
    color: d.color ?? DEFAULT_COLORS[i % DEFAULT_COLORS.length],
  }));

  const colors = nivoData.map((d) => d.color);

  return (
    <div style={{ width: "100%", height: `${height}px` }}>
      <ResponsivePie
        data={nivoData}
        colors={colors}
        theme={nivoTheme}
        margin={{ top: 8, right: 8, bottom: 8, left: 8 }}
        innerRadius={donut ? 0.55 : 0}
        padAngle={2}
        cornerRadius={2}
        activeOuterRadiusOffset={4}
        enableArcLabels={false}
        enableArcLinkLabels={false}
        animate={false}
        legends={
          showLegend
            ? [
                {
                  anchor: "bottom",
                  direction: "row",
                  justify: false,
                  translateY: 40,
                  itemWidth: 100,
                  itemHeight: 18,
                  itemsSpacing: 8,
                  symbolSize: 10,
                  symbolShape: "circle",
                  itemTextColor: "var(--ao-font-color-secondary)",
                },
              ]
            : []
        }
      />
    </div>
  );
}

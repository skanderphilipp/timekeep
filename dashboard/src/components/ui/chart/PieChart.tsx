import { ResponsivePie } from "@nivo/pie";

import { useChartTheme } from "./use-chart-theme";

export type SliceDef = {
  name: string;
  value: number;
  /** CSS color or `var(--ao-*)` token reference. Defaults to the categorical palette. */
  color?: string;
};

export type PieChartProps = {
  data: SliceDef[];
  height?: number;
  donut?: boolean;
  showLegend?: boolean;
};

export function PieChart({ data, height = 250, donut = false, showLegend = true }: PieChartProps) {
  const { categorical, nivo, resolveColor } = useChartTheme();

  if (data.length === 0) return null;

  const nivoData = data.map((d, i) => ({
    id: d.name,
    label: d.name,
    value: d.value,
    color: d.color ? resolveColor(d.color) : categorical[i % categorical.length],
  }));

  const colors = nivoData.map((d) => d.color);

  return (
    <div style={{ width: "100%", height: `${height}px` }}>
      <ResponsivePie
        data={nivoData}
        colors={colors}
        theme={nivo}
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
                  itemTextColor: nivo.legends.text.fill,
                },
              ]
            : []
        }
      />
    </div>
  );
}

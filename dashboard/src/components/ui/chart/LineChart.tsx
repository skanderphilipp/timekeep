import { ResponsiveLine } from "@nivo/line";

import { useChartTheme } from "./use-chart-theme";

export type LineDef = {
  dataKey: string;
  /** CSS color or `var(--ao-*)` token reference. Defaults to the categorical palette. */
  stroke?: string;
  name?: string;
  dot?: boolean;
  areaFill?: number;
};

export type LineChartProps = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: Record<string, any>[];
  lines: LineDef[];
  xKey: string;
  height?: number;
  grid?: boolean;
};

function toSeries(data: Record<string, unknown>[], lines: LineDef[], xKey: string) {
  return lines.map((line) => ({
    id: line.name ?? line.dataKey,
    data: data.map((d) => ({
      x: d[xKey] as string | number,
      y: d[line.dataKey] as number,
    })),
  }));
}

export function LineChart({ data, lines, xKey, height = 300, grid = false }: LineChartProps) {
  const { categorical, nivo, resolveColor } = useChartTheme();

  const series = toSeries(data, lines, xKey);
  const colors = lines.map((l, i) =>
    l.stroke ? resolveColor(l.stroke) : categorical[i % categorical.length],
  );
  const hasArea = lines.some((l) => l.areaFill != null);
  const hasDots = lines.some((l) => l.dot === true);

  return (
    <div style={{ width: "100%", height: `${height}px` }}>
      <ResponsiveLine
        data={series}
        colors={colors}
        theme={nivo}
        margin={{ top: 8, right: 8, bottom: 36, left: 48 }}
        enableGridX={grid}
        enableGridY={grid}
        axisBottom={{ tickSize: 0, tickPadding: 6 }}
        axisLeft={{ tickSize: 0, tickPadding: 6 }}
        enablePoints={hasDots}
        pointSize={6}
        pointColor={{ from: "color" }}
        pointBorderWidth={2}
        pointBorderColor={{ from: "serieColor" }}
        useMesh={true}
        enableArea={hasArea}
        areaOpacity={0.15}
        animate={false}
        lineWidth={2}
      />
    </div>
  );
}

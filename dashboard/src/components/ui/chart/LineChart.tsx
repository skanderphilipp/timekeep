import { type ReactNode } from "react";
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

/** Data passed to the tooltip render prop. */
export type LinePointTooltipData = {
  x: string | number;
  y: number;
  /** The line definition's dataKey (e.g., "hours", "regular"). */
  dataKey: string;
  /** The line definition's display name, if set. */
  name?: string;
};

export type LineChartProps = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: Record<string, any>[];
  lines: LineDef[];
  xKey: string;
  height?: number;
  grid?: boolean;
  /** Label for the value (y) axis. */
  yLabel?: string;
  /** Enable hover/focus interactivity. Default true. */
  interactive?: boolean;
  /** Enable mount/unmount animations. Default true. */
  animate?: boolean;
  /** Custom tooltip renderer. Called for each point on hover via crosshair. */
  tooltip?: (point: LinePointTooltipData) => ReactNode;
  /**
   * Called when a data point is clicked.
   * Receives the original data row.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onClick?: (row: Record<string, any>) => void;
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

export function LineChart({
  data,
  lines,
  xKey,
  height = 300,
  grid = false,
  yLabel,
  interactive = true,
  animate = true,
  tooltip,
  onClick,
}: LineChartProps) {
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
        axisLeft={{
          tickSize: 0,
          tickPadding: 6,
          ...(yLabel ? { legend: yLabel, legendOffset: -40, legendPosition: "middle" } : {}),
        }}
        enablePoints={hasDots}
        pointSize={6}
        pointColor={{ from: "color" }}
        pointBorderWidth={2}
        pointBorderColor={{ from: "serieColor" }}
        useMesh={true}
        enableArea={hasArea}
        areaOpacity={0.15}
        animate={animate}
        motionConfig="gentle"
        lineWidth={2}
        // ── Interaction ────────────────────────────────────────
        isInteractive={interactive}
        onClick={(point) => {
          if (!onClick) return;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const pt = point as any;
          const xVal = pt?.data?.x ?? pt?.x;
          const row = data.find((d) => String(d[xKey]) === String(xVal));
          if (row) onClick(row);
        }}
        // ── Crosshair tooltip ──────────────────────────────────
        enableSlices="x"
        sliceTooltip={
          tooltip
            ? ({ slice }) => {
                const points = slice.points.map((p) => {
                  const lineDef = lines.find(
                    (l) => (l.name ?? l.dataKey) === p.seriesId,
                  );
                  return tooltip({
                    x: p.data.x as string | number,
                    y: p.data.y as number,
                    dataKey: lineDef?.dataKey ?? p.seriesId.toString(),
                    name: lineDef?.name,
                  });
                });
                // Render all lines' values for this x-position
                return <div>{points}</div>;
              }
            : undefined
        }
      />
    </div>
  );
}

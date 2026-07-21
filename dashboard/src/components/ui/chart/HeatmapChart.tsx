import { ResponsiveHeatMap } from "@nivo/heatmap";
import type { HeatMapSerie, HeatMapDatum } from "@nivo/heatmap";

import { useChartTheme } from "./use-chart-theme";

export type HeatmapCell = {
  x: string | number;
  y: number | null;
};

export type HeatmapSerieDef = {
  id: string;
  data: HeatmapCell[];
};

export type HeatmapChartProps = {
  data: HeatmapSerieDef[];
  height?: number;
  xLabel?: string;
  yLabel?: string;
  /** Colors: [minValue color, maxValue color] — sequential gradient scale. */
  colors?: [string, string];
  /**
   * Called when a cell is clicked.
   * Receives the cell datum with x, y, and serieId.
   */
  onClick?: (cell: { x: string | number; y: number | null; serieId: string }) => void;
};

/**
 * Heatmap for device utilization or similar time × category matrices.
 *
 * User story US-CHARTS-F02:
 *   Device utilization matrix — hour × device × punch count.
 */
export function HeatmapChart({
  data,
  height = 300,
  xLabel,
  yLabel,
  colors,
  onClick,
}: HeatmapChartProps) {
  const { nivo, resolveColor } = useChartTheme();

  const defaultColors: [string, string] = [
    resolveColor("var(--ao-chart-neutral)"),
    resolveColor("var(--ao-chart-primary)"),
  ];
  const colorRange: [string, string] =
    colors?.length === 2 ? (colors.map(resolveColor) as [string, string]) : defaultColors;

  return (
    <div data-slot="heatmap-chart" style={{ width: "100%", height: `${height}px` }}>
      <ResponsiveHeatMap
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        data={data as unknown as HeatMapSerie<HeatMapDatum, Record<string, any>>[]}
        theme={nivo}
        margin={{ top: 32, right: 8, bottom: 60, left: 60 }}
        forceSquare
        colors={{ type: "sequential", colors: colorRange }}
        // ── Axes ─────────────────────────────────────────────────
        axisTop={null}
        axisRight={null}
        axisBottom={{
          tickSize: 0,
          tickPadding: 6,
          legend: xLabel,
          legendOffset: 36,
          legendPosition: "middle",
        }}
        axisLeft={{
          tickSize: 0,
          tickPadding: 6,
          legend: yLabel,
          legendOffset: -40,
          legendPosition: "middle",
        }}
        // ── Borders & spacing ────────────────────────────────────
        borderWidth={1}
        borderColor={{ from: "color", modifiers: [["darker", 0.4]] }}
        // ── Labels ───────────────────────────────────────────────
        enableLabels={false}
        // ── Interaction ──────────────────────────────────────────
        isInteractive={!!onClick}
        hoverTarget="cell"
        onClick={(cell) => {
          if (!onClick) return;
          onClick({
            x: cell.x,
            y: cell.y ?? null,
            serieId: cell.serieId,
          });
        }}
        animate={false}
      />
    </div>
  );
}

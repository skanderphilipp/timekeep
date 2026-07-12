import { ResponsiveScatterPlot } from "@nivo/scatterplot";
import type { ScatterPlotRawSerie, ScatterPlotDatum, ScatterPlotNodeData } from "@nivo/scatterplot";

import { useChartTheme } from "./use-chart-theme";

export type ScatterSerieDef = {
  id: string;
  data: { x: number; y: number }[];
};

export type ScatterPlotChartProps = {
  data: ScatterSerieDef[];
  height?: number;
  xLabel?: string;
  yLabel?: string;
  grid?: boolean;
  bubbleSize?: number;
  /**
   * Called when a point is clicked.
   * Receives the serie id and the x/y values.
   */
  onClick?: (point: { id: string; x: number; y: number }) => void;
};

/**
 * Scatter plot for correlation analysis.
 *
 * Potential use cases:
 *   - Hours worked vs attendance rate correlation
 *   - Check-in time vs punctuality score
 */
export function ScatterPlotChart({
  data,
  height = 350,
  xLabel,
  yLabel,
  grid = true,
  bubbleSize = 10,
  onClick,
}: ScatterPlotChartProps) {
  const { nivo } = useChartTheme();

  return (
    <div style={{ width: "100%", height: `${height}px` }}>
      <ResponsiveScatterPlot
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        data={data as unknown as ScatterPlotRawSerie<ScatterPlotDatum>[]}
        theme={nivo}
        margin={{ top: 32, right: 32, bottom: 60, left: 60 }}
        colors={{ scheme: "nivo" }}
        blendMode="normal"
        nodeSize={bubbleSize}
        // ── Grid ─────────────────────────────────────────────────
        enableGridX={grid}
        enableGridY={grid}
        // ── Axes ─────────────────────────────────────────────────
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
          legendOffset: -44,
          legendPosition: "middle",
        }}
        // ── Interaction ──────────────────────────────────────────
        isInteractive={!!onClick || true}
        onClick={(point) => {
          if (!onClick) return;
          onClick({
            id: point.serieId as string,
            x: Number(point.data.x),
            y: Number(point.data.y),
          });
        }}
        animate={false}
        // ── Tooltip shows x, y, and serie ───────────────────────
        tooltip={({ node }: { node: ScatterPlotNodeData<ScatterPlotDatum> }) => (
          <div
            style={{
              background: nivo.tooltip?.container?.background ?? "#202020",
              color: nivo.tooltip?.container?.color ?? "#fcfcfc",
              padding: "6px 10px",
              borderRadius: "4px",
              fontSize: "12px",
              fontFamily: nivo.text?.fontFamily ?? "Inter, sans-serif",
              boxShadow: "0 2px 8px rgba(0,0,0,0.12)",
            }}
          >
            <strong>{node.serieId}</strong>
            <br />
            {xLabel ? `${xLabel}: ` : "x: "}
            {String(node.data.x)}
            <br />
            {yLabel ? `${yLabel}: ` : "y: "}
            {String(node.data.y)}
          </div>
        )}
      />
    </div>
  );
}

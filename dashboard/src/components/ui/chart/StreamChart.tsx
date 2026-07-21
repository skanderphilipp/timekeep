import { ResponsiveStream } from "@nivo/stream";
import type { StreamDatum } from "@nivo/stream";

import { useChartTheme } from "./use-chart-theme";

export type StreamSeriesDef = {
  dataKey: string;
  /** CSS color or `var(--ao-*)` token reference. Defaults to the categorical palette. */
  stroke?: string;
  name?: string;
};

export type StreamChartProps = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: Record<string, any>[];
  series: StreamSeriesDef[];
  height?: number;
  grid?: boolean;
  fillOpacity?: number;
};

/**
 * Stream chart for stacked area flows over time.
 *
 * Potential use cases:
 *   - Attendance flow over time (stacked area by status)
 *   - Punch type distribution over the day
 *
 * Note: Nivo Stream does not expose a simple onClick — interaction is
 * handled via built-in tooltips and hover highlighting.
 */
export function StreamChart({
  data,
  series,
  height = 300,
  grid = false,
  fillOpacity = 0.85,
}: StreamChartProps) {
  const { categorical, nivo, resolveColor } = useChartTheme();

  const keys = series.map((s) => s.dataKey);
  const colors = series.map((s, i) =>
    s.stroke ? resolveColor(s.stroke) : categorical[i % categorical.length],
  );

  return (
    <div data-slot="stream-chart" style={{ width: "100%", height: `${height}px` }}>
      <ResponsiveStream
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        data={data as unknown as StreamDatum[]}
        keys={keys}
        theme={nivo}
        margin={{ top: 8, right: 8, bottom: 36, left: 48 }}
        colors={colors}
        fillOpacity={fillOpacity}
        borderWidth={0}
        // ── Grid ─────────────────────────────────────────────────
        enableGridX={grid}
        enableGridY={grid}
        // ── Axes ─────────────────────────────────────────────────
        axisBottom={{ tickSize: 0, tickPadding: 6 }}
        axisLeft={{ tickSize: 0, tickPadding: 6 }}
        // ── Dots disabled ────────────────────────────────────────
        enableDots={false}
        dotSize={0}
        // ── Tooltip ──────────────────────────────────────────────
        // Nivo Stream has built-in tooltip support via enableStackTooltip.
        enableStackTooltip={true}
        animate={false}
      />
    </div>
  );
}

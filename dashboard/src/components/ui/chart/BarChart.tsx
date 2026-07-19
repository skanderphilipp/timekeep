import { type ReactNode } from "react";
import { ResponsiveBar } from "@nivo/bar";
import type { BarDatum } from "@nivo/bar";

import { useChartTheme } from "./use-chart-theme";

export type BarDef = {
  dataKey: string;
  /** CSS color or `var(--ao-*)` token reference. Defaults to the categorical palette. */
  fill?: string;
  name?: string;
  stackId?: string;
};

/** Data passed to the tooltip render prop. */
export type BarTooltipData = {
  label: string;
  value: number;
  /** The bar definition's dataKey (e.g., "value", "count"). */
  dataKey: string;
  /** The bar definition's display name, if set. */
  name?: string;
};

export type BarChartProps = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: Record<string, any>[];
  bars: BarDef[];
  xKey: string;
  height?: number;
  layout?: "vertical" | "horizontal";
  grid?: boolean;
  /** Label for the value (y) axis. */
  yLabel?: string;
  /** Enable hover/focus interactivity. Default true. */
  interactive?: boolean;
  /** Enable mount/unmount animations. Default true. */
  animate?: boolean;
  /** Custom tooltip renderer. */
  tooltip?: (bar: BarTooltipData) => ReactNode;
  /**
   * Called when a bar is clicked.
   * The callback receives the raw bar data item from the data array.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onClick?: (datum: Record<string, any>) => void;
};

/**
 * Nivo bar chart wrapper with design-token theme.
 *
 * Wrapped in a sized container — nivo's `ResponsiveBar` fills it.
 * Must be placed inside a `<Chart>` for title / loading / empty states.
 */
export function BarChart({
  data,
  bars,
  xKey,
  height = 300,
  layout = "vertical",
  grid = false,
  yLabel,
  interactive = true,
  animate = true,
  tooltip,
  onClick,
}: BarChartProps) {
  const { categorical, nivo, resolveColor } = useChartTheme();

  const keys = bars.map((b) => b.dataKey);
  const colors = bars.map((b, i) =>
    b.fill ? resolveColor(b.fill) : categorical[i % categorical.length],
  );

  return (
    <div style={{ width: "100%", height: `${height}px` }}>
      <ResponsiveBar
        data={data as unknown as readonly BarDatum[]}
        keys={keys}
        indexBy={xKey}
        theme={nivo}
        layout={layout}
        margin={{ top: 8, right: 8, bottom: 36, left: 48 }}
        padding={0.3}
        colors={colors}
        enableGridX={grid}
        enableGridY={grid}
        axisBottom={{ tickSize: 0, tickPadding: 6 }}
        axisLeft={{
          tickSize: 0,
          tickPadding: 6,
          ...(yLabel ? { legend: yLabel, legendOffset: -40, legendPosition: "middle" } : {}),
        }}
        borderRadius={4}
        enableLabel={false}
        animate={animate}
        motionConfig="gentle"
        // ── Interaction ────────────────────────────────────────
        isInteractive={interactive}
        onClick={(bar) => {
          if (!onClick) return;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const indexValue = (bar as any).indexValue as string;
          const row = data.find((d) => String(d[xKey]) === String(indexValue));
          if (row) onClick(row);
        }}
        // ── Tooltip ────────────────────────────────────────────
        tooltip={
          tooltip
            ? (bar) => {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const b = bar as any;
                const barIndex = Number(b.index);
                const barDef = bars[barIndex];
                return tooltip({
                  label: String(b.indexValue ?? ""),
                  value: Number(b.formattedValue ?? 0),
                  dataKey: barDef?.dataKey ?? "",
                  name: barDef?.name,
                });
              }
            : undefined
        }
      />
    </div>
  );
}

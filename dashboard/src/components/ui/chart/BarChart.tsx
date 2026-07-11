import { ResponsiveBar } from "@nivo/bar";

import { nivoTheme } from "./nivo-theme";

export type BarDef = {
  dataKey: string;
  fill?: string;
  name?: string;
  stackId?: string;
};

export type BarChartProps = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: Record<string, any>[];
  bars: BarDef[];
  xKey: string;
  height?: number;
  layout?: "vertical" | "horizontal";
  grid?: boolean;
};

/**
 * Nivo bar chart wrapper with design-token theme.
 *
 * Wrapped in a sized container — nivo's `ResponsiveBar` fills it.
 * Must be placed inside a `<Chart>` for title / loading / empty states.
 */
export function BarChart({ data, bars, xKey, height = 300, layout = "vertical", grid = false }: BarChartProps) {
  const keys = bars.map((b) => b.dataKey);
  const colors = bars.map((b) => b.fill ?? "var(--ao-accent-accent9)");

  return (
    <div style={{ width: "100%", height: `${height}px` }}>
      <ResponsiveBar
        data={data}
        keys={keys}
        indexBy={xKey}
        theme={nivoTheme}
        layout={layout}
        margin={{ top: 8, right: 8, bottom: 36, left: 48 }}
        padding={0.3}
        colors={colors}
        enableGridX={grid}
        enableGridY={grid}
        axisBottom={{ tickSize: 0, tickPadding: 6 }}
        axisLeft={{ tickSize: 0, tickPadding: 6 }}
        borderRadius={4}
        enableLabel={false}
        animate={false}
      />
    </div>
  );
}

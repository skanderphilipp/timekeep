import { BarChart as RechartsBar, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";

/**
 * Bar chart wrapper using Recharts with design-token-driven colors.
 *
 * @example
 * ```tsx
 * <BarChart
 *   data={[{ month: "Jan", count: 42 }, { month: "Feb", count: 58 }]}
 *   bars={[{ dataKey: "count", fill: "var(--ao-accent-accent9)" }]}
 *   xKey="month"
 * />
 * ```
 */

type BarDef = {
  dataKey: string;
  fill?: string;
  name?: string;
  radius?: [number, number, number, number];
};

type BarChartProps = {
  data: Record<string, unknown>[];
  bars: BarDef[];
  xKey: string;
  height?: number;
  grid?: boolean;
};

export function BarChart({
  data,
  bars,
  xKey,
  grid = false,
}: BarChartProps) {
  return (
    <RechartsBar data={data} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
      {grid && <CartesianGrid strokeDasharray="3 3" stroke="var(--ao-border-color-light)" />}
      <XAxis
        dataKey={xKey}
        tick={{ fontSize: 12, fill: "var(--ao-font-color-tertiary)" }}
        axisLine={{ stroke: "var(--ao-border-color-light)" }}
        tickLine={false}
      />
      <YAxis
        tick={{ fontSize: 12, fill: "var(--ao-font-color-tertiary)" }}
        axisLine={false}
        tickLine={false}
      />
      <Tooltip
        contentStyle={{
          background: "var(--ao-background-primary)",
          border: "1px solid var(--ao-border-color-medium)",
          borderRadius: "var(--ao-border-radius-sm)",
          fontSize: "12px",
        }}
      />
      {bars.map((bar) => (
        <Bar
          key={bar.dataKey}
          dataKey={bar.dataKey}
          fill={bar.fill ?? "var(--ao-accent-accent9)"}
          name={bar.name}
          radius={bar.radius ?? [4, 4, 0, 0]}
        />
      ))}
    </RechartsBar>
  );
}

import { LineChart as RechartsLine, Line, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";

type LineDef = {
  dataKey: string;
  stroke?: string;
  name?: string;
  dot?: boolean;
};

type LineChartProps = {
  data: Record<string, unknown>[];
  lines: LineDef[];
  xKey: string;
  height?: number;
  grid?: boolean;
};

export function LineChart({
  data,
  lines,
  xKey,
  grid = false,
}: LineChartProps) {
  return (
    <RechartsLine data={data} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
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
      {lines.map((line) => (
        <Line
          key={line.dataKey}
          type="monotone"
          dataKey={line.dataKey}
          stroke={line.stroke ?? "var(--ao-accent-accent9)"}
          name={line.name}
          strokeWidth={2}
          dot={line.dot ?? false}
          activeDot={{ r: 4 }}
        />
      ))}
    </RechartsLine>
  );
}

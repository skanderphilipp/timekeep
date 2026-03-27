import { PieChart as RechartsPie, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from "recharts";

type SliceDef = {
  name: string;
  value: number;
  color?: string;
};

type PieChartProps = {
  data: SliceDef[];
  height?: number;
  donut?: boolean;
  showLegend?: boolean;
};

const COLORS = [
  "var(--ao-accent-accent9)",
  "var(--ao-color-green9)",
  "var(--ao-color-amber9)",
  "var(--ao-color-red9)",
  "var(--ao-accent-accent7)",
  "var(--ao-color-green7)",
];

export function PieChart({
  data,
  height = 300,
  donut = false,
  showLegend = true,
}: PieChartProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <RechartsPie>
        <Pie
          data={data}
          dataKey="value"
          nameKey="name"
          cx="50%"
          cy="50%"
          innerRadius={donut ? 60 : 0}
          outerRadius={100}
          paddingAngle={2}
        >
          {data.map((entry, index) => (
            <Cell
              key={entry.name}
              fill={entry.color ?? COLORS[index % COLORS.length]}
            />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{
            background: "var(--ao-background-primary)",
            border: "1px solid var(--ao-border-color-medium)",
            borderRadius: "var(--ao-border-radius-sm)",
            fontSize: "12px",
          }}
        />
        {showLegend && (
          <Legend
            wrapperStyle={{ fontSize: "12px" }}
            iconType="circle"
            iconSize={8}
          />
        )}
      </RechartsPie>
    </ResponsiveContainer>
  );
}

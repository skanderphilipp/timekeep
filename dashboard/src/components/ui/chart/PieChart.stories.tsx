import type { Meta, StoryObj } from "@storybook/react";
import { PieChart } from "./PieChart";
import { Chart } from "./chart";

const statusData = [
  { name: "Full Day", value: 195, color: "var(--ao-color-green9)" },
  { name: "Half Day", value: 30, color: "var(--ao-color-amber9)" },
  { name: "Absent", value: 25, color: "var(--ao-color-red9)" },
];

const punchData = [
  { name: "Check In", value: 220 },
  { name: "Check Out", value: 210 },
  { name: "Break Out", value: 55 },
  { name: "Break In", value: 50 },
];

const meta: Meta<typeof PieChart> = {
  title: "UI/Charts/PieChart",
  component: PieChart,
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof PieChart>;

export const Primary: Story = {
  render: () => (
    <Chart title="Attendance Status" description="This month's distribution.">
      <PieChart data={statusData} donut showLegend height={250} />
    </Chart>
  ),
};

export const StandardPie: Story = {
  name: "Standard Pie (no legend)",
  render: () => (
    <Chart title="Punch Type Distribution">
      <PieChart data={punchData} showLegend={false} height={280} />
    </Chart>
  ),
};

export const SmallDonut: Story = {
  name: "Small Donut (compact)",
  render: () => (
    <div style={{ maxWidth: 280 }}>
      <Chart title="Compact Donut">
        <PieChart data={statusData} donut height={200} />
      </Chart>
    </div>
  ),
};

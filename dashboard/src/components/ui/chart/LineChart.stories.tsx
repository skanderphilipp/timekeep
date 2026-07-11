import type { Meta, StoryObj } from "@storybook/react";
import { LineChart } from "./LineChart";
import { Chart } from "./chart";

const monthlyData = [
  { month: "Mar", rate: 95 },
  { month: "Apr", rate: 92 },
  { month: "May", rate: 98 },
  { month: "Jun", rate: 96 },
  { month: "Jul", rate: 100 },
];

const meta: Meta<typeof LineChart> = {
  title: "UI/Charts/LineChart",
  component: LineChart,
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof LineChart>;

export const Primary: Story = {
  render: () => (
    <Chart title="Monthly Attendance Trend" description="Attendance % over time.">
      <LineChart
        data={monthlyData}
        xKey="month"
        lines={[{ dataKey: "rate", name: "Attendance %" }]}
        grid
        height={250}
      />
    </Chart>
  ),
};

export const WithAreaFill: Story = {
  name: "With Area Fill",
  render: () => (
    <Chart title="With Subtle Fill" description="Area fill at 15% opacity.">
      <LineChart
        data={monthlyData}
        xKey="month"
        lines={[{ dataKey: "rate", name: "Attendance %", areaFill: 0.15, dot: true }]}
        grid
        height={250}
      />
    </Chart>
  ),
};

export const MultiLine: Story = {
  name: "Multi-Line",
  render: () => (
    <Chart title="Punch Comparison" description="Check-ins vs Check-outs.">
      <LineChart
        data={[
          { month: "Mar", checkins: 220, checkouts: 210 },
          { month: "Apr", checkins: 240, checkouts: 235 },
          { month: "May", checkins: 200, checkouts: 195 },
          { month: "Jun", checkins: 260, checkouts: 255 },
        ]}
        xKey="month"
        lines={[
          { dataKey: "checkins", stroke: "var(--ao-color-green9)", name: "Check Ins" },
          { dataKey: "checkouts", stroke: "var(--ao-accent-accent9)", name: "Check Outs" },
        ]}
        grid
        height={250}
      />
    </Chart>
  ),
};

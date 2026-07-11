import type { Meta, StoryObj } from "@storybook/react";
import { BarChart } from "./BarChart";
import { Chart } from "./chart";

const arrivalData = [
  { hour: "06:00", count: 8 },
  { hour: "07:00", count: 22 },
  { hour: "08:00", count: 15 },
  { hour: "09:00", count: 4 },
  { hour: "10:00", count: 2 },
];

const weeklyData = [
  { week: "W25", hours: 280 },
  { week: "W26", hours: 295 },
  { week: "W27", hours: 310 },
  { week: "W28", hours: 288 },
];

const dailyHoursData = [
  { date: "Jan 1", regular: 7.5, overtime: 1.0 },
  { date: "Jan 2", regular: 8.0, overtime: 0.5 },
  { date: "Jan 3", regular: 7.0, overtime: 2.0 },
  { date: "Jan 4", regular: 8.0, overtime: 0 },
  { date: "Jan 5", regular: 7.8, overtime: 0.8 },
];

const meta: Meta<typeof BarChart> = {
  title: "UI/Charts/BarChart",
  component: BarChart,
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof BarChart>;

export const Primary: Story = {
  render: () => (
    <Chart title="Hourly Arrivals" description="Check-ins per hour today.">
      <BarChart data={arrivalData} bars={[{ dataKey: "count" }]} xKey="hour" grid height={250} />
    </Chart>
  ),
};

export const HorizontalBar: Story = {
  name: "Horizontal (Week-over-Week)",
  render: () => (
    <Chart title="Weekly Hours" description="Total hours per week.">
      <BarChart
        data={weeklyData}
        layout="horizontal"
        bars={[{ dataKey: "hours", fill: "var(--ao-color-green9)", name: "Total Hours" }]}
        xKey="week"
        height={250}
      />
    </Chart>
  ),
};

export const StackedBar: Story = {
  name: "Stacked (Daily Hours)",
  render: () => (
    <Chart title="Daily Hours" description="Regular + Overtime breakdown.">
      <BarChart
        data={dailyHoursData}
        bars={[
          { dataKey: "regular", fill: "var(--ao-color-green9)", stackId: "hours", name: "Regular" },
          {
            dataKey: "overtime",
            fill: "var(--ao-accent-accent9)",
            stackId: "hours",
            name: "Overtime",
          },
        ]}
        xKey="date"
        grid
        height={250}
      />
    </Chart>
  ),
};

export const WithoutGrid: Story = {
  name: "Without Grid",
  render: () => (
    <Chart title="Without Grid">
      <BarChart
        data={weeklyData}
        bars={[{ dataKey: "hours", fill: "var(--ao-color-green9)" }]}
        xKey="week"
        height={200}
      />
    </Chart>
  ),
};

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

// ── Primary ───────────────────────────────────────────────────────────────

export const Primary: Story = {
  render: () => (
    <Chart title="Attendance Status" description="This month's distribution.">
      <PieChart data={statusData} donut showLegend height={250} />
    </Chart>
  ),
};

// ── Variants ──────────────────────────────────────────────────────────────

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

// ── States ────────────────────────────────────────────────────────────────

export const Loading: Story = {
  name: "Loading State",
  render: () => (
    <Chart title="Attendance Status" description="Fetching distribution…" isLoading>
      <PieChart data={statusData} donut showLegend height={250} />
    </Chart>
  ),
};

export const ErrorState: Story = {
  name: "Error State",
  render: () => (
    <Chart
      title="Attendance Status"
      description="Could not load distribution data."
      error={new globalThis.Error("The report period may be invalid — check the date range.")}
    >
      <PieChart data={statusData} donut showLegend height={250} />
    </Chart>
  ),
};

export const Empty: Story = {
  name: "Empty State",
  render: () => (
    <Chart
      title="Attendance Status"
      description="No attendance data available."
      isEmpty
      emptyMessage="No attendance data for this period"
    >
      <PieChart data={[]} height={250} />
    </Chart>
  ),
};

// ── Interaction ───────────────────────────────────────────────────────────

export const WithOnClick: Story = {
  name: "Interactive (onClick)",
  render: () => (
    <Chart title="Attendance Status" description="Click a slice to filter the employee table.">
      <PieChart
        data={statusData}
        donut
        showLegend
        height={250}
        onClick={(slice) => {
          alert(`${slice.id}: ${slice.value} employee-days (${slice.formattedValue})`);
        }}
      />
    </Chart>
  ),
};

// ── Responsive ────────────────────────────────────────────────────────────

export const NarrowContainer: Story = {
  name: "Narrow Container (280px)",
  render: () => (
    <div style={{ maxWidth: 280 }}>
      <Chart title="Compact Donut">
        <PieChart data={statusData} donut height={180} />
      </Chart>
    </div>
  ),
};

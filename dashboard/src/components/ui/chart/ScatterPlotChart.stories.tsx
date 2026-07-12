import type { Meta, StoryObj } from "@storybook/react";
import { ScatterPlotChart } from "./ScatterPlotChart";
import { Chart } from "./chart";

function generateCorrelationData(
  label: string,
  count: number,
  xBase: number,
  yBase: number,
  xNoise: number,
  yNoise: number,
) {
  return {
    id: label,
    data: Array.from({ length: count }, () => ({
      x: Math.round((xBase + (Math.random() - 0.5) * xNoise * 2) * 10) / 10,
      y: Math.round((yBase + (Math.random() - 0.5) * yNoise * 2) * 10) / 10,
    })),
  };
}

const hoursVsAttendance = [
  generateCorrelationData("Employees", 50, 8.0, 92, 1.5, 8),
];

const multiGroupData = [
  generateCorrelationData("Operations", 20, 8.2, 95, 1.0, 6),
  generateCorrelationData("Warehouse", 20, 7.8, 85, 1.5, 12),
  generateCorrelationData("Admin", 10, 8.5, 98, 0.5, 3),
];

const meta: Meta<typeof ScatterPlotChart> = {
  title: "UI/Charts/ScatterPlotChart",
  component: ScatterPlotChart,
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof ScatterPlotChart>;

// ── Primary ───────────────────────────────────────────────────────────────

export const Primary: Story = {
  render: () => (
    <Chart title="Hours vs Attendance" description="Each dot = one employee's monthly average.">
      <ScatterPlotChart
        data={hoursVsAttendance}
        xLabel="Avg Daily Hours"
        yLabel="Attendance %"
        height={350}
      />
    </Chart>
  ),
};

// ── Variants ──────────────────────────────────────────────────────────────

export const ByDepartment: Story = {
  name: "By Department",
  render: () => (
    <Chart title="Hours vs Attendance by Department" description="Operations, Warehouse, Admin clusters.">
      <ScatterPlotChart
        data={multiGroupData}
        xLabel="Avg Daily Hours"
        yLabel="Attendance %"
        height={350}
      />
    </Chart>
  ),
};

export const SmallDataset: Story = {
  name: "Small Dataset (10 points)",
  render: () => (
    <Chart title="Punctuality vs Hours" description="Small sample size.">
      <ScatterPlotChart
        data={[generateCorrelationData("Employees", 10, 8.0, 90, 1.0, 5)]}
        xLabel="Avg Daily Hours"
        yLabel="Punctuality %"
        height={300}
        bubbleSize={14}
      />
    </Chart>
  ),
};

// ── States ────────────────────────────────────────────────────────────────

export const Loading: Story = {
  name: "Loading State",
  render: () => (
    <Chart title="Hours vs Attendance" description="Fetching correlation data…" isLoading>
      <ScatterPlotChart data={hoursVsAttendance} xLabel="Hours" yLabel="Attendance %" height={300} />
    </Chart>
  ),
};

export const ErrorState: Story = {
  name: "Error State",
  render: () => (
    <Chart
      title="Hours vs Attendance"
      description="Could not load correlation data."
      error={new globalThis.Error("Not enough employee data for correlation analysis.")}
    >
      <ScatterPlotChart data={hoursVsAttendance} xLabel="Hours" yLabel="Attendance %" height={300} />
    </Chart>
  ),
};

export const Empty: Story = {
  name: "Empty State",
  render: () => (
    <Chart title="Hours vs Attendance" description="No data." isEmpty emptyMessage="No employee data available for correlation">
      <ScatterPlotChart data={[]} xLabel="Hours" yLabel="Attendance %" height={300} />
    </Chart>
  ),
};

// ── Responsive ────────────────────────────────────────────────────────────

export const NarrowContainer: Story = {
  name: "Narrow Container (320px)",
  render: () => (
    <div style={{ maxWidth: 320 }}>
      <Chart title="Hours vs Attendance">
        <ScatterPlotChart
          data={[generateCorrelationData("Employees", 15, 8.0, 90, 1.0, 5)]}
          xLabel="Hours"
          yLabel="%"
          height={250}
          bubbleSize={8}
        />
      </Chart>
    </div>
  ),
};

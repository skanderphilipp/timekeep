import type { Meta, StoryObj } from "@storybook/react";
import { StreamChart } from "./StreamChart";
import { Chart } from "./chart";

const hourlyStatusData = [
  { hour: "06:00", check_in: 8, check_out: 0, break_out: 0, break_in: 0 },
  { hour: "07:00", check_in: 22, check_out: 0, break_out: 0, break_in: 0 },
  { hour: "08:00", check_in: 15, check_out: 0, break_out: 2, break_in: 0 },
  { hour: "09:00", check_in: 5, check_out: 2, break_out: 1, break_in: 1 },
  { hour: "10:00", check_in: 2, check_out: 3, break_out: 0, break_in: 2 },
  { hour: "12:00", check_in: 0, check_out: 0, break_out: 20, break_in: 0 },
  { hour: "13:00", check_in: 0, check_out: 0, break_out: 0, break_in: 18 },
  { hour: "16:00", check_in: 0, check_out: 12, break_out: 2, break_in: 1 },
  { hour: "17:00", check_in: 0, check_out: 25, break_out: 0, break_in: 0 },
  { hour: "18:00", check_in: 0, check_out: 10, break_out: 0, break_in: 0 },
];

const meta: Meta<typeof StreamChart> = {
  title: "UI/Charts/StreamChart",
  component: StreamChart,
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof StreamChart>;

// ── Primary ───────────────────────────────────────────────────────────────

export const Primary: Story = {
  render: () => (
    <Chart title="Punch Flow" description="Stacked area by punch type over the day.">
      <StreamChart
        data={hourlyStatusData}
        series={[
          { dataKey: "check_in", name: "Check In", stroke: "var(--ao-chart-positive)" },
          { dataKey: "check_out", name: "Check Out", stroke: "var(--ao-chart-negative)" },
          { dataKey: "break_out", name: "Break Out", stroke: "var(--ao-chart-warning)" },
          { dataKey: "break_in", name: "Break In", stroke: "var(--ao-chart-info)" },
        ]}
        height={300}
        grid
      />
    </Chart>
  ),
};

// ── Variants ──────────────────────────────────────────────────────────────

export const AttendanceFlow: Story = {
  name: "Attendance Flow",
  render: () => (
    <Chart title="Attendance Flow" description="Full, half, absent, late by day.">
      <StreamChart
        data={[
          { day: "Mon", full: 42, half: 3, absent: 2, late: 3 },
          { day: "Tue", full: 40, half: 5, absent: 3, late: 2 },
          { day: "Wed", full: 38, half: 4, absent: 4, late: 4 },
          { day: "Thu", full: 41, half: 3, absent: 2, late: 4 },
          { day: "Fri", full: 35, half: 8, absent: 5, late: 2 },
        ]}
        series={[
          { dataKey: "full", name: "Full Day", stroke: "var(--ao-chart-positive)" },
          { dataKey: "half", name: "Half Day", stroke: "var(--ao-chart-warning)" },
          { dataKey: "absent", name: "Absent", stroke: "var(--ao-chart-negative)" },
          { dataKey: "late", name: "Late", stroke: "var(--ao-chart-info)" },
        ]}
        height={300}
        grid
      />
    </Chart>
  ),
};

// ── States ────────────────────────────────────────────────────────────────

export const Loading: Story = {
  name: "Loading State",
  render: () => (
    <Chart title="Punch Flow" description="Fetching punch data…" isLoading>
      <StreamChart
        data={hourlyStatusData}
        series={[{ dataKey: "check_in", name: "Check In" }]}
        height={250}
      />
    </Chart>
  ),
};

export const ErrorState: Story = {
  name: "Error State",
  render: () => (
    <Chart
      title="Punch Flow"
      description="Could not load flow data."
      error={new globalThis.Error("No punch data exists for this date range.")}
    >
      <StreamChart
        data={hourlyStatusData}
        series={[{ dataKey: "check_in", name: "Check In" }]}
        height={250}
      />
    </Chart>
  ),
};

export const Empty: Story = {
  name: "Empty State",
  render: () => (
    <Chart title="Punch Flow" description="No data to display." isEmpty emptyMessage="No punches recorded for this period">
      <StreamChart data={[]} series={[{ dataKey: "check_in", name: "Check In" }]} height={250} />
    </Chart>
  ),
};

// ── Responsive ────────────────────────────────────────────────────────────

export const NarrowContainer: Story = {
  name: "Narrow Container (320px)",
  render: () => (
    <div style={{ maxWidth: 320 }}>
      <Chart title="Punch Flow">
        <StreamChart
          data={hourlyStatusData.slice(0, 6)}
          series={[
            { dataKey: "check_in", name: "In" },
            { dataKey: "check_out", name: "Out" },
          ]}
          height={200}
        />
      </Chart>
    </div>
  ),
};

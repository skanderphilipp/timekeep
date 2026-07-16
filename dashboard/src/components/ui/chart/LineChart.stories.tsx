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
  tags: ["autodocs", "level:primitive"],
};

export default meta;
type Story = StoryObj<typeof LineChart>;

// ── Primary ───────────────────────────────────────────────────────────────

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

// ── Variants ──────────────────────────────────────────────────────────────

export const WithAreaFill: Story = {
  name: "With Area Fill & Dots",
  render: () => (
    <Chart title="With Subtle Fill" description="Area fill at 15% opacity with point markers.">
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

// ── States ────────────────────────────────────────────────────────────────

export const Loading: Story = {
  name: "Loading State",
  render: () => (
    <Chart title="Monthly Trend" description="Fetching attendance data…" isLoading>
      <LineChart
        data={monthlyData}
        xKey="month"
        lines={[{ dataKey: "rate", name: "Attendance %" }]}
        height={250}
      />
    </Chart>
  ),
};

export const ErrorState: Story = {
  name: "Error State",
  render: () => (
    <Chart
      title="Monthly Trend"
      description="Could not load trend data."
      error={new globalThis.Error("The employee may have been deleted or the API is unreachable.")}
    >
      <LineChart
        data={monthlyData}
        xKey="month"
        lines={[{ dataKey: "rate", name: "Attendance %" }]}
        height={250}
      />
    </Chart>
  ),
};

export const Empty: Story = {
  name: "Empty State",
  render: () => (
    <Chart
      title="Monthly Trend"
      description="New employee — not enough data yet."
      isEmpty
      emptyMessage="Not enough data yet — check back after the first month"
    >
      <LineChart data={[]} xKey="month" lines={[{ dataKey: "rate" }]} height={250} />
    </Chart>
  ),
};

// ── Interaction ───────────────────────────────────────────────────────────

export const WithOnClick: Story = {
  name: "Interactive (onClick)",
  render: () => (
    <Chart title="Monthly Trend" description="Click a data point.">
      <LineChart
        data={monthlyData}
        xKey="month"
        lines={[{ dataKey: "rate", name: "Attendance %", dot: true }]}
        grid
        height={250}
        onClick={(row) => {
          alert(`${row.month}: ${row.rate}%`);
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
      <Chart title="Monthly Trend" description="Fits in a narrow container.">
        <LineChart
          data={monthlyData}
          xKey="month"
          lines={[{ dataKey: "rate", name: "%" }]}
          grid
          height={200}
        />
      </Chart>
    </div>
  ),
};

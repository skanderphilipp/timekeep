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
  { date: "Jul 1", regular: 7.5, overtime: 1.0 },
  { date: "Jul 2", regular: 8.0, overtime: 0.5 },
  { date: "Jul 3", regular: 7.0, overtime: 2.0 },
  { date: "Jul 4", regular: 8.0, overtime: 0 },
  { date: "Jul 5", regular: 7.8, overtime: 0.8 },
];

const meta: Meta<typeof BarChart> = {
  title: "UI/Charts/BarChart",
  component: BarChart,
  tags: ["autodocs", "level:primitive"],
};

export default meta;
type Story = StoryObj<typeof BarChart>;

// ── Primary ───────────────────────────────────────────────────────────────

export const Primary: Story = {
  render: () => (
    <Chart title="Hourly Arrivals" description="Check-ins per hour today.">
      <BarChart data={arrivalData} bars={[{ dataKey: "count" }]} xKey="hour" grid height={250} />
    </Chart>
  ),
};

// ── Variants ──────────────────────────────────────────────────────────────

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

// ── States ────────────────────────────────────────────────────────────────

export const Loading: Story = {
  name: "Loading State",
  render: () => (
    <Chart title="Hourly Arrivals" description="Fetching today's data…" isLoading>
      <BarChart data={arrivalData} bars={[{ dataKey: "count" }]} xKey="hour" height={250} />
    </Chart>
  ),
};

export const ErrorState: Story = {
  name: "Error State",
  render: () => (
    <Chart
      title="Hourly Arrivals"
      description="Could not load data."
      error={new globalThis.Error("Network request failed — the API may be unreachable.")}
    >
      <BarChart data={arrivalData} bars={[{ dataKey: "count" }]} xKey="hour" height={250} />
    </Chart>
  ),
};

export const Empty: Story = {
  name: "Empty State",
  render: () => (
    <Chart
      title="Hourly Arrivals"
      description="No arrivals recorded yet today."
      isEmpty
      emptyMessage="No arrivals yet today"
    >
      <BarChart data={[]} bars={[{ dataKey: "count" }]} xKey="hour" height={250} />
    </Chart>
  ),
};

// ── Interaction ───────────────────────────────────────────────────────────

export const WithOnClick: Story = {
  name: "Interactive (onClick)",
  render: () => (
    <Chart title="Hourly Arrivals" description="Click a bar to see the hour.">
      <BarChart
        data={arrivalData}
        bars={[{ dataKey: "count" }]}
        xKey="hour"
        height={250}
        onClick={(datum) => {
          alert(`${datum.hour}: ${datum.count} arrivals`);
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
      <Chart title="Hourly Arrivals" description="Fits in a narrow sidebar.">
        <BarChart
          data={arrivalData.slice(0, 4)}
          bars={[{ dataKey: "count" }]}
          xKey="hour"
          height={200}
        />
      </Chart>
    </div>
  ),
};

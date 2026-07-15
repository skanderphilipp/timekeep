import type { Meta, StoryObj } from "@storybook/react";
import { Chart } from "./chart";
import { BarChart } from "./BarChart";
import { PieChart } from "./PieChart";
import { LineChart } from "./LineChart";

const arrivalData = [
  { hour: "06:00", count: 8 },
  { hour: "07:00", count: 22 },
  { hour: "08:00", count: 15 },
  { hour: "09:00", count: 4 },
  { hour: "10:00", count: 2 },
];

const statusData = [
  { name: "Full Day", value: 195, color: "var(--ao-color-green9)" },
  { name: "Half Day", value: 30, color: "var(--ao-color-amber9)" },
  { name: "Absent", value: 25, color: "var(--ao-color-red9)" },
];

const meta: Meta<typeof Chart> = {
  title: "UI/Charts/Chart (Wrapper)",
  component: Chart,
  tags: ["autodocs"],
  argTypes: {
    isLoading: { control: "boolean" },
    isEmpty: { control: "boolean" },
  },
};

export default meta;
type Story = StoryObj<typeof Chart>;

// ── Primary ───────────────────────────────────────────────────────────────

export const Primary: Story = {
  args: {
    title: "Hourly Arrivals",
    description: "Number of check-ins per hour today.",
    children: (
      <BarChart data={arrivalData} bars={[{ dataKey: "count" }]} xKey="hour" grid height={300} />
    ),
  },
};

// ── States (Wrapper Level) ────────────────────────────────────────────────

export const LoadingState: Story = {
  name: "Loading State",
  args: {
    title: "Hourly Arrivals",
    description: "Fetching data…",
    isLoading: true,
    children: <div />,
  },
};

export const ErrorState: Story = {
  name: "Error State",
  args: {
    title: "Hourly Arrivals",
    description: "Data fetch failed.",
    error: new Error("Network request failed — the API may be unreachable."),
    children: <div />,
  },
};

export const EmptyState: Story = {
  name: "Empty State",
  args: {
    title: "Hourly Arrivals",
    description: "Check back after the workday starts.",
    isEmpty: true,
    emptyMessage: "No arrivals recorded yet today",
    children: <div />,
  },
};

export const WithFooter: Story = {
  name: "With Footer (e.g., legend info)",
  args: {
    title: "Attendance Status",
    description: "This month's distribution.",
    footer: (
      <span style={{ fontSize: "var(--ao-font-size-xs)", color: "var(--ao-font-color-tertiary)" }}>
        Data from all devices. Last updated: just now.
      </span>
    ),
    children: <PieChart data={statusData} donut showLegend height={250} />,
  },
};

// ── Context Layouts ───────────────────────────────────────────────────────

export const AllVariants: Story = {
  name: "All Variants",
  parameters: { controls: { disable: true } },
  render: () => (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--ao-spacing-6)" }}>
      <Chart title="Simple Bar Chart" description="Hourly arrival data.">
        <BarChart data={arrivalData} bars={[{ dataKey: "count" }]} xKey="hour" grid height={250} />
      </Chart>
      <Chart title="Donut Chart" description="Attendance status distribution.">
        <PieChart data={statusData} donut showLegend height={250} />
      </Chart>
      <Chart title="Loading State" description="Data is being fetched." isLoading>
        <div />
      </Chart>
      <Chart
        title="Empty State"
        description="No data for this period."
        isEmpty
        emptyMessage="No arrivals recorded today."
      >
        <div />
      </Chart>
      <Chart
        title="Error State"
        description="Something went wrong."
        error={new Error("The server returned a 500 error.")}
      >
        <div />
      </Chart>
    </div>
  ),
};

export const ContextReportsCharts: Story = {
  name: "Context: Reports Page",
  parameters: { controls: { disable: true } },
  render: () => (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--ao-spacing-4)" }}>
      <Chart title="Daily Hours" description="Regular + Overtime breakdown.">
        <BarChart
          data={[
            { date: "Jul 1", regular: 7.5, overtime: 1.0 },
            { date: "Jul 2", regular: 8.0, overtime: 0.5 },
            { date: "Jul 3", regular: 7.0, overtime: 2.0 },
            { date: "Jul 4", regular: 8.0, overtime: 0 },
            { date: "Jul 5", regular: 7.8, overtime: 0.8 },
          ]}
          bars={[
            { dataKey: "regular", fill: "var(--ao-color-green9)", name: "Regular" },
            { dataKey: "overtime", fill: "var(--ao-accent-accent9)", name: "Overtime" },
          ]}
          xKey="date"
          grid
          height={250}
        />
      </Chart>
      <Chart title="Attendance Status" description="This month's distribution.">
        <PieChart data={statusData} donut showLegend height={250} />
      </Chart>
    </div>
  ),
};

export const ContextEmployeeDetailCharts: Story = {
  name: "Context: Employee Detail Page",
  parameters: { controls: { disable: true } },
  render: () => (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--ao-spacing-4)" }}>
      <Chart title="Monthly Trend" description="Attendance % over 6 months.">
        <LineChart
          data={[
            { month: "Feb", rate: 88 },
            { month: "Mar", rate: 92 },
            { month: "Apr", rate: 95 },
            { month: "May", rate: 90 },
            { month: "Jun", rate: 97 },
            { month: "Jul", rate: 100 },
          ]}
          xKey="month"
          lines={[{ dataKey: "rate", name: "Attendance %", dot: true }]}
          grid
          height={250}
        />
      </Chart>
    </div>
  ),
};

export const AllStatesOverview: Story = {
  name: "All States Overview",
  parameters: { controls: { disable: true } },
  render: () => (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--ao-spacing-4)" }}>
      <Chart title="✅ Normal Data" description="Chart renders correctly.">
        <BarChart data={arrivalData} bars={[{ dataKey: "count" }]} xKey="hour" height={200} />
      </Chart>
      <Chart title="⏳ Loading" description="Spinner displayed in body." isLoading>
        <div />
      </Chart>
      <Chart
        title="❌ Error"
        description="Error message displayed."
        error={new Error("API unreachable.")}
      >
        <div />
      </Chart>
      <Chart
        title="📭 Empty"
        description="Empty state displayed."
        isEmpty
        emptyMessage="Nothing to show"
      >
        <div />
      </Chart>
    </div>
  ),
};

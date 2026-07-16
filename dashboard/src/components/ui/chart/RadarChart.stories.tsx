import type { Meta, StoryObj } from "@storybook/react";
import { RadarChart } from "./RadarChart";
import { Chart } from "./chart";

const kpiData = [
  {
    employee: "Ahmed A.",
    punctuality: 92,
    hours_consistency: 85,
    attendance_rate: 98,
    overtime_reliability: 70,
    break_compliance: 88,
  },
  {
    employee: "Fatima H.",
    punctuality: 98,
    hours_consistency: 90,
    attendance_rate: 95,
    overtime_reliability: 85,
    break_compliance: 92,
  },
];

const singleEmployeeData = [
  {
    employee: "Ahmed A.",
    punctuality: 92,
    hours_consistency: 85,
    attendance_rate: 98,
    overtime_reliability: 70,
    break_compliance: 88,
  },
];

const meta: Meta<typeof RadarChart> = {
  title: "UI/Charts/RadarChart",
  component: RadarChart,
  tags: ["autodocs", "level:primitive"],
};

export default meta;
type Story = StoryObj<typeof RadarChart>;

// ── Primary ───────────────────────────────────────────────────────────────

export const Primary: Story = {
  render: () => (
    <Chart
      title="Employee KPI Radar"
      description="Punctuality, hours, attendance, overtime, breaks."
    >
      <RadarChart
        data={singleEmployeeData}
        axes={[
          { dataKey: "punctuality", name: "Punctuality" },
          { dataKey: "hours_consistency", name: "Hours Consistency" },
          { dataKey: "attendance_rate", name: "Attendance Rate" },
          { dataKey: "overtime_reliability", name: "Overtime Reliability" },
          { dataKey: "break_compliance", name: "Break Compliance" },
        ]}
        indexBy="employee"
        maxValue={100}
        height={350}
      />
    </Chart>
  ),
};

// ── Variants ──────────────────────────────────────────────────────────────

export const CompareTwoEmployees: Story = {
  name: "Compare Two Employees",
  render: () => (
    <Chart title="KPI Comparison" description="Ahmed vs Fatima across 5 KPIs.">
      <RadarChart
        data={kpiData}
        axes={[
          { dataKey: "punctuality", name: "Punctuality" },
          { dataKey: "hours_consistency", name: "Hours Consistency" },
          { dataKey: "attendance_rate", name: "Attendance Rate" },
          { dataKey: "overtime_reliability", name: "Overtime Reliability" },
          { dataKey: "break_compliance", name: "Break Compliance" },
        ]}
        indexBy="employee"
        maxValue={100}
        height={350}
      />
    </Chart>
  ),
};

export const WithoutGrid: Story = {
  name: "Without Grid",
  render: () => (
    <Chart title="KPI Radar" description="No circular grid lines.">
      <RadarChart
        data={singleEmployeeData}
        axes={[
          { dataKey: "punctuality", name: "Punctuality" },
          { dataKey: "hours_consistency", name: "Hours" },
          { dataKey: "attendance_rate", name: "Attendance" },
        ]}
        indexBy="employee"
        maxValue={100}
        gridLevels={0}
        height={300}
      />
    </Chart>
  ),
};

// ── States ────────────────────────────────────────────────────────────────

export const Loading: Story = {
  name: "Loading State",
  render: () => (
    <Chart title="KPI Radar" description="Fetching KPI data…" isLoading>
      <RadarChart
        data={singleEmployeeData}
        axes={[{ dataKey: "punctuality", name: "Punctuality" }]}
        indexBy="employee"
        height={300}
      />
    </Chart>
  ),
};

export const ErrorState: Story = {
  name: "Error State",
  render: () => (
    <Chart
      title="KPI Radar"
      description="Could not load KPI data."
      error={new globalThis.Error("Employee KPIs not yet computed — check back next month.")}
    >
      <RadarChart
        data={singleEmployeeData}
        axes={[{ dataKey: "punctuality", name: "Punctuality" }]}
        indexBy="employee"
        height={300}
      />
    </Chart>
  ),
};

export const Empty: Story = {
  name: "Empty State",
  render: () => (
    <Chart
      title="KPI Radar"
      description="No KPI data available."
      isEmpty
      emptyMessage="No KPI data yet"
    >
      <RadarChart
        data={[]}
        axes={[{ dataKey: "punctuality", name: "Punctuality" }]}
        indexBy="employee"
        height={300}
      />
    </Chart>
  ),
};

// ── Responsive ────────────────────────────────────────────────────────────

export const NarrowContainer: Story = {
  name: "Narrow Container (320px)",
  render: () => (
    <div style={{ maxWidth: 320 }}>
      <Chart title="KPI Radar">
        <RadarChart
          data={singleEmployeeData}
          axes={[
            { dataKey: "punctuality", name: "Punct." },
            { dataKey: "hours_consistency", name: "Hours" },
            { dataKey: "attendance_rate", name: "Attend." },
            { dataKey: "overtime_reliability", name: "OT" },
            { dataKey: "break_compliance", name: "Breaks" },
          ]}
          indexBy="employee"
          maxValue={100}
          height={280}
        />
      </Chart>
    </div>
  ),
};

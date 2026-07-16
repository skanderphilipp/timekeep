import type { Meta, StoryObj } from "@storybook/react";
import { BumpChart } from "./BumpChart";
import { Chart } from "./chart";

const rankingData = [
  {
    id: "Ahmed A.",
    data: [
      { x: "Jan", y: 2 },
      { x: "Feb", y: 1 },
      { x: "Mar", y: 3 },
      { x: "Apr", y: 2 },
      { x: "May", y: 1 },
      { x: "Jun", y: 1 },
    ],
  },
  {
    id: "Fatima H.",
    data: [
      { x: "Jan", y: 1 },
      { x: "Feb", y: 2 },
      { x: "Mar", y: 1 },
      { x: "Apr", y: 1 },
      { x: "May", y: 2 },
      { x: "Jun", y: 3 },
    ],
  },
  {
    id: "Omar K.",
    data: [
      { x: "Jan", y: 5 },
      { x: "Feb", y: 4 },
      { x: "Mar", y: 2 },
      { x: "Apr", y: 3 },
      { x: "May", y: 4 },
      { x: "Jun", y: 2 },
    ],
  },
  {
    id: "Layla N.",
    data: [
      { x: "Jan", y: 3 },
      { x: "Feb", y: 3 },
      { x: "Mar", y: 4 },
      { x: "Apr", y: 5 },
      { x: "May", y: 3 },
      { x: "Jun", y: 5 },
    ],
  },
  {
    id: "Bilal M.",
    data: [
      { x: "Jan", y: 4 },
      { x: "Feb", y: 5 },
      { x: "Mar", y: 5 },
      { x: "Apr", y: 4 },
      { x: "May", y: 5 },
      { x: "Jun", y: 4 },
    ],
  },
];

const meta: Meta<typeof BumpChart> = {
  title: "UI/Charts/BumpChart",
  component: BumpChart,
  tags: ["autodocs", "level:primitive"],
};

export default meta;
type Story = StoryObj<typeof BumpChart>;

// ── Primary ───────────────────────────────────────────────────────────────

export const Primary: Story = {
  render: () => (
    <Chart
      title="Employee Attendance Ranking"
      description="Rank 1 = best attendance. Lines crossing = rank changes."
    >
      <BumpChart data={rankingData} height={350} />
    </Chart>
  ),
};

// ── Variants ──────────────────────────────────────────────────────────────

export const WithoutEndLabels: Story = {
  name: "Without End Labels",
  render: () => (
    <Chart title="Ranking Trend" description="No labels on the right side.">
      <BumpChart data={rankingData} height={300} endLabel={false} />
    </Chart>
  ),
};

export const TwoEmployees: Story = {
  name: "Two Employees",
  render: () => (
    <Chart title="Head-to-Head" description="Ahmed vs Omar ranking battle.">
      <BumpChart data={rankingData.slice(0, 2)} height={250} />
    </Chart>
  ),
};

// ── States ────────────────────────────────────────────────────────────────

export const Loading: Story = {
  name: "Loading State",
  render: () => (
    <Chart title="Employee Ranking" description="Fetching ranking data…" isLoading>
      <BumpChart data={rankingData} height={300} />
    </Chart>
  ),
};

export const ErrorState: Story = {
  name: "Error State",
  render: () => (
    <Chart
      title="Employee Ranking"
      description="Could not load ranking data."
      error={new globalThis.Error("Not enough employees to compute rankings.")}
    >
      <BumpChart data={rankingData} height={300} />
    </Chart>
  ),
};

export const Empty: Story = {
  name: "Empty State",
  render: () => (
    <Chart
      title="Employee Ranking"
      description="No ranking data."
      isEmpty
      emptyMessage="No rankings available for this period"
    >
      <BumpChart data={[]} height={300} />
    </Chart>
  ),
};

// ── Responsive ────────────────────────────────────────────────────────────

export const NarrowContainer: Story = {
  name: "Narrow Container (360px)",
  render: () => (
    <div style={{ maxWidth: 360 }}>
      <Chart title="Ranking">
        <BumpChart data={rankingData.slice(0, 3)} height={280} endLabel={false} />
      </Chart>
    </div>
  ),
};

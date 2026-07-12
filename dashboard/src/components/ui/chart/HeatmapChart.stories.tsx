import type { Meta, StoryObj } from "@storybook/react";
import { HeatmapChart } from "./HeatmapChart";
import { Chart } from "./chart";

// Simulated device utilization: 3 devices × 8 hours
const hours = [6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17];

function buildDeviceData(deviceName: string, baseMultiplier: number) {
  return {
    id: deviceName,
    data: hours.map((hour) => ({
      x: `${String(hour).padStart(2, "0")}:00`,
      y: Math.round((3 + Math.random() * 12) * baseMultiplier),
    })),
  };
}

const utilizationData = [
  buildDeviceData("Main Gate", 1.5),
  buildDeviceData("Warehouse B", 1.0),
  buildDeviceData("Office Floor", 0.6),
];

const meta: Meta<typeof HeatmapChart> = {
  title: "UI/Charts/HeatmapChart",
  component: HeatmapChart,
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof HeatmapChart>;

// ── Primary ───────────────────────────────────────────────────────────────

export const Primary: Story = {
  render: () => (
    <Chart title="Device Utilization" description="Punch count per hour per device.">
      <HeatmapChart
        data={utilizationData}
        xLabel="Hour of Day"
        yLabel="Device"
        height={300}
      />
    </Chart>
  ),
};

// ── Variants ──────────────────────────────────────────────────────────────

export const ColorScale: Story = {
  name: "Custom Color Scale",
  render: () => (
    <Chart title="Device Utilization" description="Green gradient scale.">
      <HeatmapChart
        data={utilizationData}
        xLabel="Hour"
        yLabel="Device"
        colors={["var(--ao-chart-neutral)", "var(--ao-chart-positive)"]}
        height={300}
      />
    </Chart>
  ),
};

export const SingleDevice: Story = {
  name: "Single Device",
  render: () => (
    <Chart title="Main Gate Utilization" description="Hourly punch count.">
      <HeatmapChart
        data={[buildDeviceData("Main Gate", 1.5)]}
        xLabel="Hour"
        yLabel="Device"
        height={120}
      />
    </Chart>
  ),
};

// ── States ────────────────────────────────────────────────────────────────

export const Loading: Story = {
  name: "Loading State",
  render: () => (
    <Chart title="Device Utilization" description="Fetching device data…" isLoading>
      <HeatmapChart data={utilizationData} height={300} />
    </Chart>
  ),
};

export const ErrorState: Story = {
  name: "Error State",
  render: () => (
    <Chart
      title="Device Utilization"
      description="Could not load device data."
      error={new globalThis.Error("No devices are currently connected.")}
    >
      <HeatmapChart data={utilizationData} height={300} />
    </Chart>
  ),
};

export const Empty: Story = {
  name: "Empty State",
  render: () => (
    <Chart title="Device Utilization" description="No utilization data." isEmpty emptyMessage="No data for this period">
      <HeatmapChart data={[]} height={300} />
    </Chart>
  ),
};

// ── Responsive ────────────────────────────────────────────────────────────

export const NarrowContainer: Story = {
  name: "Narrow Container (320px)",
  render: () => (
    <div style={{ maxWidth: 320 }}>
      <Chart title="Device Utilization">
        <HeatmapChart data={utilizationData.slice(0, 2)} xLabel="Hour" height={200} />
      </Chart>
    </div>
  ),
};

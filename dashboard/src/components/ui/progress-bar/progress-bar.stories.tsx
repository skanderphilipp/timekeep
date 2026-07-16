import type { Meta, StoryObj } from "@storybook/react";
import { ProgressBar } from "./progress-bar";

/**
 * ProgressBar — linear progress indicator.
 *
 * Used for storage gauges, sync progress, and completion tracking.
 */
const meta: Meta<typeof ProgressBar> = {
  title: "UI/Feedback/ProgressBar",
  component: ProgressBar,
  tags: ["autodocs", "level:primitive"],
  argTypes: {
    value: { control: { type: "range", min: 0, max: 100, step: 1 } },
  },
};

export default meta;
type Story = StoryObj<typeof ProgressBar>;

export const Primary: Story = {
  args: { value: 50 },
};

export const AllVariants: Story = {
  name: "All Variants",
  parameters: { controls: { disable: true } },
  render: () => (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "var(--ao-spacing-4)",
        padding: "var(--ao-spacing-4)",
        width: 300,
      }}
    >
      <ProgressBar value={0} />
      <ProgressBar value={25} />
      <ProgressBar value={50} />
      <ProgressBar value={75} />
      <ProgressBar value={100} />
    </div>
  ),
};

export const ContextStorageGauge: Story = {
  name: "Context: Storage Gauge",
  parameters: { controls: { disable: true } },
  render: () => (
    <div style={{ padding: "var(--ao-spacing-4)", width: 300 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
        <span style={{ fontSize: 14 }}>Storage Used</span>
        <span style={{ fontSize: 14, fontWeight: 600 }}>75%</span>
      </div>
      <ProgressBar value={75} />
      <span
        style={{
          fontSize: 12,
          color: "var(--ao-font-color-tertiary)",
          marginTop: 4,
          display: "block",
        }}
      >
        45,230 / 60,000 records
      </span>
    </div>
  ),
};

import type { Meta, StoryObj } from "@storybook/react";
import { StorageGauge } from "./storage-gauge";

const meta: Meta<typeof StorageGauge> = {
  title: "UI/Charts/StorageGauge",
  component: StorageGauge,
  tags: ["autodocs"],
  argTypes: {
    percentage: { control: { type: "range", min: 0, max: 100, step: 1 } },
  },
};

export default meta;
type Story = StoryObj<typeof StorageGauge>;

export const Primary: Story = {
  args: { percentage: 45, current: 45230, capacity: 100000, label: "Records" },
};

export const AllVariants: Story = {
  name: "All Variants",
  parameters: { controls: { disable: true } },
  render: () => (
    <div style={{ display: "flex", gap: "var(--ao-spacing-6)", flexWrap: "wrap", padding: "var(--ao-spacing-4)" }}>
      <StorageGauge percentage={25} current={25000} capacity={100000} label="Safe" />
      <StorageGauge percentage={65} current={65000} capacity={100000} label="Warning" />
      <StorageGauge percentage={90} current={90000} capacity={100000} label="Critical" />
    </div>
  ),
};

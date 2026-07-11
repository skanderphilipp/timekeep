import type { Meta, StoryObj } from "@storybook/react";
import { CircularProgressBar } from "./circular-progress-bar";

const meta: Meta<typeof CircularProgressBar> = {
  title: "UI/Feedback/CircularProgressBar",
  component: CircularProgressBar,
  tags: ["autodocs"],
  argTypes: {
    size: { control: { type: "range", min: 20, max: 120, step: 5 } },
    barWidth: { control: { type: "range", min: 2, max: 12, step: 1 } },
  },
};

export default meta;
type Story = StoryObj<typeof CircularProgressBar>;

export const Primary: Story = {
  args: { size: 50, barWidth: 5 },
};

export const AllVariants: Story = {
  name: "All Variants",
  parameters: { controls: { disable: true } },
  render: () => (
    <div style={{ display: "flex", gap: "var(--ao-spacing-4)", alignItems: "center", padding: "var(--ao-spacing-4)" }}>
      <CircularProgressBar size={24} barWidth={3} />
      <CircularProgressBar size={40} barWidth={4} />
      <CircularProgressBar size={60} barWidth={6} />
      <CircularProgressBar size={80} barWidth={8} barColor="var(--ao-accent-accent9)" />
    </div>
  ),
};

export const ContextPageLoader: Story = {
  name: "Context: Page Loading",
  parameters: { controls: { disable: true } },
  render: () => (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "var(--ao-spacing-16)", gap: "var(--ao-spacing-4)" }}>
      <CircularProgressBar size={60} barWidth={6} barColor="var(--ao-accent-accent9)" />
      <span style={{ fontSize: 14, color: "var(--ao-font-color-secondary)" }}>Loading dashboard data…</span>
    </div>
  ),
};

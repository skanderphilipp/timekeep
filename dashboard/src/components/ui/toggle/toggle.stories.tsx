import type { Meta, StoryObj } from "@storybook/react";
import { Toggle } from "./toggle";

/**
 * Toggle — on/off switch for settings and filters.
 *
 * Used in the punches page ("Show only anomalies") and
 * settings page (auto-discover toggle).
 */
const meta: Meta<typeof Toggle> = {
  title: "UI/Inputs/Toggle",
  component: Toggle,
  tags: ["autodocs"],
  argTypes: {
    checked: { control: "boolean" },
  },
};

export default meta;
type Story = StoryObj<typeof Toggle>;

export const Primary: Story = {
  args: { checked: true, label: "Show only anomalies" },
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
      }}
    >
      <div style={{ display: "flex", gap: "var(--ao-spacing-4)", alignItems: "center" }}>
        <Toggle checked label="Show only anomalies" />
        <span>Checked with label</span>
      </div>
      <div style={{ display: "flex", gap: "var(--ao-spacing-4)", alignItems: "center" }}>
        <Toggle checked={false} label="Auto-discover devices" />
        <span>Unchecked with label</span>
      </div>
      <div style={{ display: "flex", gap: "var(--ao-spacing-4)", alignItems: "center" }}>
        <Toggle checked />
        <span>No label</span>
      </div>
      <div style={{ display: "flex", gap: "var(--ao-spacing-4)", alignItems: "center" }}>
        <Toggle checked disabled label="Disabled" />
        <span>Disabled</span>
      </div>
    </div>
  ),
};

export const ContextAnomalyFilter: Story = {
  name: "Context: Anomaly Filter",
  parameters: { controls: { disable: true } },
  render: () => (
    <div
      style={{
        padding: "var(--ao-spacing-4)",
        display: "flex",
        alignItems: "center",
        gap: "var(--ao-spacing-3)",
      }}
    >
      <Toggle checked label="Show only anomalies" />
      <span style={{ color: "var(--ao-font-color-secondary)", fontSize: 14 }}>
        3 anomalies detected
      </span>
    </div>
  ),
};

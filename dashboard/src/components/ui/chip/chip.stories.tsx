import type { Meta, StoryObj } from "@storybook/react";
import { Chip, ChipAccent, ChipVariant, ChipSize } from "./chip";

/**
 * Chip — compact label with optional icon and accent.
 *
 * Used for filter chips, status indicators, and removable tags.
 */
const meta: Meta<typeof Chip> = {
  title: "UI/Data Display/Chip",
  component: Chip,
  tags: ["autodocs"],
  argTypes: {
    accent: { control: "select", options: Object.values(ChipAccent) },
    variant: { control: "select", options: Object.values(ChipVariant) },
    size: { control: "select", options: Object.values(ChipSize) },
  },
};

export default meta;
type Story = StoryObj<typeof Chip>;

export const Primary: Story = {
  args: { label: "Active Filter", variant: ChipVariant.Highlighted },
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
      <div style={{ display: "flex", gap: "var(--ao-spacing-2)", flexWrap: "wrap" }}>
        <Chip label="Default" />
        <Chip label="Highlighted" variant={ChipVariant.Highlighted} />
        <Chip label="Transparent" variant={ChipVariant.Transparent} />
      </div>
      <div style={{ display: "flex", gap: "var(--ao-spacing-2)", flexWrap: "wrap" }}>
        <Chip label="Small" />
        <Chip label="Large" size={ChipSize.Large} />
      </div>
      <div style={{ display: "flex", gap: "var(--ao-spacing-2)", flexWrap: "wrap" }}>
        <Chip label="With Icon" leftComponent="🔍" />
      </div>
    </div>
  ),
};

export const ContextFilterChips: Story = {
  name: "Context: Active Filters",
  parameters: { controls: { disable: true } },
  render: () => (
    <div
      style={{
        display: "flex",
        gap: "var(--ao-spacing-2)",
        flexWrap: "wrap",
        padding: "var(--ao-spacing-4)",
      }}
    >
      <Chip label="Device: Main Gate" variant={ChipVariant.Highlighted} />
      <Chip label="Status: Check In" variant={ChipVariant.Highlighted} />
      <Chip label="From: 2026-07-01" variant={ChipVariant.Highlighted} />
    </div>
  ),
};

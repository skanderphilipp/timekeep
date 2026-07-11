import type { Meta, StoryObj } from "@storybook/react";
import { Checkbox } from "./checkbox";
import { Text } from "../text";

/**
 * Checkbox — binary toggle for forms and lists.
 *
 * Follows the native input pattern: checked, unchecked, disabled.
 * Used in settings (working days), filters, and multi-select lists.
 */
const meta: Meta<typeof Checkbox> = {
  title: "UI/Inputs/Checkbox",
  component: Checkbox,
  tags: ["autodocs"],
  argTypes: {
    checked: { control: "boolean" },
    disabled: { control: "boolean" },
  },
};

export default meta;
type Story = StoryObj<typeof Checkbox>;

export const Primary: Story = {
  args: { checked: true },
};

export const AllVariants: Story = {
  name: "All Variants",
  parameters: { controls: { disable: true } },
  render: () => (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--ao-spacing-3)", padding: "var(--ao-spacing-4)" }}>
      <div style={{ display: "flex", gap: "var(--ao-spacing-4)", alignItems: "center" }}>
        <Checkbox checked={false} />
        <Text variant="body">Unchecked</Text>
      </div>
      <div style={{ display: "flex", gap: "var(--ao-spacing-4)", alignItems: "center" }}>
        <Checkbox checked />
        <Text variant="body">Checked</Text>
      </div>
      <div style={{ display: "flex", gap: "var(--ao-spacing-4)", alignItems: "center" }}>
        <Checkbox checked={false} disabled />
        <Text variant="body" color="tertiary">Disabled (unchecked)</Text>
      </div>
      <div style={{ display: "flex", gap: "var(--ao-spacing-4)", alignItems: "center" }}>
        <Checkbox checked disabled />
        <Text variant="body" color="tertiary">Disabled (checked)</Text>
      </div>
    </div>
  ),
};

export const ContextWorkingDays: Story = {
  name: "Context: Working Days",
  parameters: { controls: { disable: true } },
  render: () => (
    <div style={{ display: "flex", gap: "var(--ao-spacing-3)", padding: "var(--ao-spacing-4)", flexWrap: "wrap" }}>
      {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => (
        <label key={day} style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <Checkbox checked={day !== "Sat" && day !== "Sun"} />
          <Text variant="body">{day}</Text>
        </label>
      ))}
    </div>
  ),
};

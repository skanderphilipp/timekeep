import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { Checkbox } from "./checkbox";
import { Text } from "../text";

/**
 * Checkbox — binary toggle for forms and lists.
 *
 * Uses @base-ui/react/checkbox primitives for full accessibility
 * (keyboard navigation, ARIA attributes, focus management).
 * Used in settings (working days), filters, and multi-select lists.
 */
const meta: Meta<typeof Checkbox> = {
  title: "UI/Inputs/Checkbox",
  component: Checkbox,
  tags: ["autodocs", "level:primitive"],
  argTypes: {
    checked: { control: "boolean" },
    disabled: { control: "boolean" },
    indeterminate: { control: "boolean" },
  },
};

export default meta;
type Story = StoryObj<typeof Checkbox>;

export const Primary: Story = {
  args: { checked: true },
};

export const Unchecked: Story = {
  args: { checked: false },
};

export const Disabled: Story = {
  args: { checked: false, disabled: true },
};

export const DisabledChecked: Story = {
  args: { checked: true, disabled: true },
};

export const Indeterminate: Story = {
  args: { indeterminate: true },
};

export const WithLabel: Story = {
  args: { checked: true, label: "Accept terms" },
};

export const AllVariants: Story = {
  name: "All Variants",
  parameters: { controls: { disable: true } },
  render: () => (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "var(--ao-spacing-3)",
        padding: "var(--ao-spacing-4)",
      }}
    >
      <div style={{ alignItems: "center", display: "flex", gap: "var(--ao-spacing-4)" }}>
        <Checkbox checked={false} />
        <Text variant="body">Unchecked</Text>
      </div>
      <div style={{ alignItems: "center", display: "flex", gap: "var(--ao-spacing-4)" }}>
        <Checkbox checked />
        <Text variant="body">Checked</Text>
      </div>
      <div style={{ alignItems: "center", display: "flex", gap: "var(--ao-spacing-4)" }}>
        <Checkbox checked={false} disabled />
        <Text variant="body" color="tertiary">
          Disabled (unchecked)
        </Text>
      </div>
      <div style={{ alignItems: "center", display: "flex", gap: "var(--ao-spacing-4)" }}>
        <Checkbox checked disabled />
        <Text variant="body" color="tertiary">
          Disabled (checked)
        </Text>
      </div>
      <div style={{ alignItems: "center", display: "flex", gap: "var(--ao-spacing-4)" }}>
        <Checkbox indeterminate />
        <Text variant="body">Indeterminate</Text>
      </div>
    </div>
  ),
};

export const Interactive: Story = {
  name: "Interactive",
  parameters: { controls: { disable: true } },
  render: () => {
    const [checked, setChecked] = useState(false);

    return (
      <div
        style={{
          alignItems: "center",
          display: "flex",
          gap: "var(--ao-spacing-3)",
          padding: "var(--ao-spacing-4)",
        }}
      >
        <Checkbox checked={checked} onCheckedChange={setChecked} label="Toggle me" />
        <Text variant="body" color="secondary">
          Currently: {checked ? "Checked" : "Unchecked"}
        </Text>
      </div>
    );
  },
};

export const ContextWorkingDays: Story = {
  name: "Context: Working Days",
  parameters: { controls: { disable: true } },
  render: () => {
    const workingDaysState = useState({
      Mon: true,
      Tue: true,
      Wed: true,
      Thu: true,
      Fri: true,
      Sat: false,
      Sun: false,
    });
    const [workingDays, setWorkingDays] = workingDaysState;

    return (
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "var(--ao-spacing-3)",
          padding: "var(--ao-spacing-4)",
        }}
      >
        {(["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const).map((day) => (
          <Checkbox
            key={day}
            checked={workingDays[day]}
            onCheckedChange={(value) => setWorkingDays((prev) => ({ ...prev, [day]: value }))}
            label={day}
          />
        ))}
      </div>
    );
  },
};

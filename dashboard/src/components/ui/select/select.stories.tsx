import type { Meta, StoryObj } from "@storybook/react";
import { Select } from "./select";

const periodOptions = [
  { value: "today", label: "Today" },
  { value: "week", label: "This Week" },
  { value: "month", label: "This Month" },
  { value: "last_month", label: "Last Month" },
  { value: "custom", label: "Custom Range" },
];

const statusOptions = [
  { value: "", label: "All Statuses" },
  { value: "check_in", label: "Check In" },
  { value: "check_out", label: "Check Out" },
  { value: "break_out", label: "Break Out" },
  { value: "break_in", label: "Break In" },
];

/**
 * Select — dropdown for choosing from a list of options.
 *
 * Used in filters, period selectors, and settings forms.
 */
const meta: Meta<typeof Select> = {
  title: "UI/Inputs/Select",
  component: Select,
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof Select>;

export const Primary: Story = {
  args: { options: periodOptions, placeholder: "Select a period…", value: "month" },
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
        maxWidth: 320,
      }}
    >
      <Select options={periodOptions} placeholder="Select a period…" value="month" />
      <Select options={periodOptions} placeholder="No selection…" />
      <Select options={statusOptions} placeholder="All Statuses" value="" />
      <Select options={[]} placeholder="No options available" />
    </div>
  ),
};

export const ContextPeriodSelector: Story = {
  name: "Context: Period Selector",
  parameters: { controls: { disable: true } },
  render: () => (
    <div style={{ padding: "var(--ao-spacing-4)", maxWidth: 250 }}>
      <Select options={periodOptions} value="month" placeholder="Select period…" />
    </div>
  ),
};

import { fn } from "storybook/test";
import type { Meta, StoryObj } from "@storybook/react";
import { IconArrowsSort, IconCalendar } from "@tabler/icons-react";
import { Tag } from "./tag";

/**
 * Tag — compact color-coded label for categorisation, filtering, and chips.
 *
 * Open UI alignment: "Tag" is the W3C name for content labels, filter chips,
 * and attribute badges. Replaces standalone Chip component.
 *
 * Used in: MultiSelect chips, FilterDropdown chips, FilterBar chips, ViewBar
 * sort/filter chips, employee status labels, attendance categories.
 */
const meta: Meta<typeof Tag> = {
  title: "UI/Data Display/Tag",
  component: Tag,
  tags: ["autodocs"],
  argTypes: {
    color: { control: "select", options: ["green", "amber", "red", "blue", "gray", "accent"] },
    variant: { control: "select", options: ["solid", "outline"] },
    weight: { control: "select", options: ["regular", "medium"] },
  },
};

export default meta;
type Story = StoryObj<typeof Tag>;

export const Primary: Story = {
  args: { text: "Active", color: "green" },
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
      {/* Solid variants */}
      <div style={{ display: "flex", gap: "var(--ao-spacing-2)", flexWrap: "wrap", alignItems: "center" }}>
        <Tag text="Active" color="green" />
        <Tag text="Pending" color="amber" />
        <Tag text="Failed" color="red" />
        <Tag text="Info" color="blue" />
        <Tag text="Draft" color="gray" />
        <Tag text="Accent" color="accent" />
      </div>

      {/* Outline variants */}
      <div style={{ display: "flex", gap: "var(--ao-spacing-2)", flexWrap: "wrap", alignItems: "center" }}>
        <Tag text="Outline" variant="outline" color="accent" />
        <Tag text="Outline" variant="outline" color="green" />
        <Tag text="Outline" variant="outline" color="amber" />
        <Tag text="Outline" variant="outline" color="red" />
      </div>

      {/* Dismissible */}
      <div style={{ display: "flex", gap: "var(--ao-spacing-2)", flexWrap: "wrap", alignItems: "center" }}>
        <Tag text="Removable" color="gray" dismissible onRemove={fn()} />
        <Tag text="Filter" color="accent" dismissible onRemove={fn()} />
        <Tag text="Error" color="red" dismissible onRemove={fn()} />
      </div>

      {/* With value (filter chip pattern) */}
      <div style={{ display: "flex", gap: "var(--ao-spacing-2)", flexWrap: "wrap", alignItems: "center" }}>
        <Tag text="Status" value="Active" color="green" dismissible onRemove={fn()} />
        <Tag text="Department" value="Engineering" color="accent" dismissible onRemove={fn()} />
        <Tag text="Date" value="Today" color="blue" Icon={IconCalendar} dismissible onRemove={fn()} />
      </div>

      {/* Interactive */}
      <div style={{ display: "flex", gap: "var(--ao-spacing-2)", flexWrap: "wrap", alignItems: "center" }}>
        <Tag text="Clickable" color="accent" onClick={fn()} />
        <Tag text="Clickable Outline" variant="outline" color="blue" onClick={fn()} />
      </div>

      {/* Disabled */}
      <div style={{ display: "flex", gap: "var(--ao-spacing-2)", flexWrap: "wrap", alignItems: "center" }}>
        <Tag text="Disabled" color="gray" disabled />
        <Tag text="Disabled" color="accent" dismissible onRemove={fn()} disabled />
      </div>

      {/* Weights */}
      <div style={{ display: "flex", gap: "var(--ao-spacing-2)", flexWrap: "wrap", alignItems: "center" }}>
        <Tag text="Regular" color="gray" />
        <Tag text="Medium" color="gray" weight="medium" />
      </div>
    </div>
  ),
};

/** Context: filter chips in a ViewBar toolbar row. */
export const ContextFilterChips: Story = {
  name: "Context: Filter Chips",
  parameters: { controls: { disable: true } },
  render: () => (
    <div
      style={{
        display: "flex",
        gap: "var(--ao-spacing-2)",
        alignItems: "center",
        padding: "var(--ao-spacing-4)",
      }}
    >
      <Tag text="Status" value="Active" color="green" dismissible onRemove={fn()} />
      <Tag text="Department" value="Engineering" color="accent" dismissible onRemove={fn()} />
      <Tag text="Sort" value="Name ↑" color="blue" Icon={IconArrowsSort} dismissible onRemove={fn()} />
    </div>
  ),
};

/** Context: employee status labels in a table row. */
export const ContextEmployeeStatus: Story = {
  name: "Context: Employee Status",
  parameters: { controls: { disable: true } },
  render: () => (
    <div
      style={{
        display: "flex",
        gap: "var(--ao-spacing-2)",
        alignItems: "center",
        padding: "var(--ao-spacing-4)",
      }}
    >
      <span style={{ fontWeight: 600, fontSize: "var(--ao-font-size-sm)" }}>Ahmed Al-Sabah</span>
      <Tag text="Present" color="green" />
      <Tag text="On Time" color="blue" />
    </div>
  ),
};

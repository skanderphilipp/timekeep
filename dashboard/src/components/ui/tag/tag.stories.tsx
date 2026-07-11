import type { Meta, StoryObj } from "@storybook/react";
import { Tag } from "./tag";

/**
 * Tag — small colored label with optional dismiss.
 *
 * Used for status labels, categories, and removable filter chips.
 */
const meta: Meta<typeof Tag> = {
  title: "UI/Data Display/Tag",
  component: Tag,
  tags: ["autodocs"],
  argTypes: {
    color: { control: "select", options: ["green", "amber", "red", "blue", "gray", "accent"] },
    variant: { control: "select", options: ["filled", "outline"] },
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
      <div style={{ display: "flex", gap: "var(--ao-spacing-2)", flexWrap: "wrap" }}>
        <Tag text="Active" color="green" />
        <Tag text="Pending" color="amber" />
        <Tag text="Failed" color="red" />
        <Tag text="Info" color="blue" />
        <Tag text="Draft" color="gray" />
      </div>
      <div style={{ display: "flex", gap: "var(--ao-spacing-2)", flexWrap: "wrap" }}>
        <Tag text="Outline" variant="outline" color="accent" />
        <Tag text="Outline Green" variant="outline" color="green" />
        <Tag text="Outline Amber" variant="outline" color="amber" />
      </div>
      <div style={{ display: "flex", gap: "var(--ao-spacing-2)", flexWrap: "wrap" }}>
        <Tag text="Removable" color="gray" dismissible onRemove={() => {}} />
      </div>
    </div>
  ),
};

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
      <span style={{ fontWeight: 600 }}>Ahmed Al-Sabah</span>
      <Tag text="Present" color="green" />
      <Tag text="On Time" color="blue" />
    </div>
  ),
};

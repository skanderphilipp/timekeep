import type { Meta, StoryObj } from "@storybook/react";
import { Text } from "./text";

/**
 * Text — the foundational typography component.
 *
 * Every page uses Text for body copy, captions, and labels.
 * Never use raw `<p>`, `<span>`, or `<label>` outside of `components/ui/`.
 */
const meta: Meta<typeof Text> = {
  title: "UI/Typography/Text",
  component: Text,
  tags: ["autodocs"],
  argTypes: {
    variant: { control: "select", options: ["body", "caption", "label"] },
    color: { control: "select", options: ["primary", "secondary", "tertiary", "danger", "success", "warning"] },
    weight: { control: "select", options: ["regular", "medium"] },
  },
};

export default meta;
type Story = StoryObj<typeof Text>;

export const Primary: Story = {
  args: { variant: "body", color: "primary", children: "This is body text — the default paragraph style." },
};

/** All semantic colors at a glance. */
export const AllColors: Story = {
  name: "All Colors",
  parameters: { controls: { disable: true } },
  render: () => (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--ao-spacing-3)", padding: "var(--ao-spacing-4)" }}>
      <Text color="primary">primary — Main content text</Text>
      <Text color="secondary">secondary — Supporting content</Text>
      <Text color="tertiary">tertiary — Metadata, hints, captions</Text>
      <Text color="danger">danger — Errors, destructive actions</Text>
      <Text color="success">success — Positive states, completions</Text>
      <Text color="warning">warning — Attention needed, pending</Text>
    </div>
  ),
};

/** All typographic variants with their default styling. */
export const AllVariants: Story = {
  name: "All Variants",
  parameters: { controls: { disable: true } },
  render: () => (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--ao-spacing-4)", padding: "var(--ao-spacing-4)" }}>
      <div>
        <Text variant="caption" color="tertiary" style={{ marginBottom: 4 }}>body (default paragraph)</Text>
        <Text variant="body">The quick brown fox jumps over the lazy dog. Attendance records are synced every 30 seconds from connected ZKTeco scanners.</Text>
      </div>
      <div>
        <Text variant="caption" color="tertiary" style={{ marginBottom: 4 }}>caption (small secondary)</Text>
        <Text variant="caption">07:42 · Main Gate · 6h 50m ago</Text>
      </div>
      <div>
        <Text variant="caption" color="tertiary" style={{ marginBottom: 4 }}>label (form label)</Text>
        <Text variant="label">Serial Number</Text>
      </div>
    </div>
  ),
};

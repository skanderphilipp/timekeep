import type { Meta, StoryObj } from "@storybook/react";
import { EllipsisDisplay } from "./ellipsis-display";
import { Text } from "../text";

const meta: Meta<typeof EllipsisDisplay> = {
  title: "UI/Data Display/EllipsisDisplay",
  component: EllipsisDisplay,
  tags: ["autodocs"],
  argTypes: {
    maxWidth: { control: { type: "number" } },
  },
};

export default meta;
type Story = StoryObj<typeof EllipsisDisplay>;

export const Primary: Story = {
  render: () => (
    <div style={{ width: 200, padding: "var(--ao-spacing-4)" }}>
      <EllipsisDisplay>
        This is a long text that will be truncated with an ellipsis when it overflows the container width.
      </EllipsisDisplay>
    </div>
  ),
};

export const AllVariants: Story = {
  name: "All Variants",
  parameters: { controls: { disable: true } },
  render: () => (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--ao-spacing-4)", padding: "var(--ao-spacing-4)" }}>
      <div style={{ width: 300 }}>
        <Text variant="caption" color="tertiary" style={{ display: "block", marginBottom: 4 }}>300px container — fits</Text>
        <EllipsisDisplay>Ahmed Al-Sabah · PIN 145 · Operations Department</EllipsisDisplay>
      </div>
      <div style={{ width: 150 }}>
        <Text variant="caption" color="tertiary" style={{ display: "block", marginBottom: 4 }}>150px container — truncates</Text>
        <EllipsisDisplay>Ahmed Al-Sabah · PIN 145 · Operations Department</EllipsisDisplay>
      </div>
      <div style={{ width: 150 }}>
        <Text variant="caption" color="tertiary" style={{ display: "block", marginBottom: 4 }}>150px + maxWidth 100px</Text>
        <EllipsisDisplay maxWidth={100}>Ahmed Al-Sabah · PIN 145 · Operations Department</EllipsisDisplay>
      </div>
    </div>
  ),
};

export const ContextTableCell: Story = {
  name: "Context: Table Cell",
  parameters: { controls: { disable: true } },
  render: () => (
    <div style={{ padding: "var(--ao-spacing-4)", maxWidth: 400 }}>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid var(--ao-border-secondary)", width: 200 }}>Name</th>
            <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid var(--ao-border-secondary)" }}>Device</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style={{ padding: 8 }}><EllipsisDisplay maxWidth={180}>Ahmed Al-Sabah · PIN 145</EllipsisDisplay></td>
            <td style={{ padding: 8 }}>Main Gate</td>
          </tr>
        </tbody>
      </table>
    </div>
  ),
};

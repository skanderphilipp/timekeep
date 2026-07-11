import type { Meta, StoryObj } from "@storybook/react";
import { Separator } from "./separator";
import { Text } from "../text";

/**
 * Separator — horizontal rule between content sections.
 *
 * Used in dropdowns, side panels, and detail views.
 */
const meta: Meta<typeof Separator> = {
  title: "UI/Separators/Separator",
  component: Separator,
  tags: ["autodocs"],
  argTypes: {
    noMargin: { control: "boolean" },
  },
};

export default meta;
type Story = StoryObj<typeof Separator>;

export const Primary: Story = {};

export const AllVariants: Story = {
  name: "All Variants",
  parameters: { controls: { disable: true } },
  render: () => (
    <div style={{ padding: "var(--ao-spacing-4)", maxWidth: 400 }}>
      <Text variant="body">Section above separator (with margin)</Text>
      <Separator />
      <Text variant="body">Section below separator (with margin)</Text>
      <Separator noMargin />
      <Text variant="body">Below no-margin separator</Text>
    </div>
  ),
};

export const ContextSidePanel: Story = {
  name: "Context: Side Panel",
  parameters: { controls: { disable: true } },
  render: () => (
    <div
      style={{
        padding: "var(--ao-spacing-4)",
        maxWidth: 300,
        border: "1px solid var(--ao-border-color-light)",
        borderRadius: "var(--ao-radius-md)",
      }}
    >
      <Text variant="body" weight="medium">
        Omar Khalid
      </Text>
      <Text variant="caption" color="tertiary">
        PIN 147
      </Text>
      <Separator />
      <Text variant="caption" color="tertiary">
        Today's Punches
      </Text>
      <Separator />
      <Text variant="caption" color="tertiary">
        Anomalies: 3
      </Text>
    </div>
  ),
};

import type { Meta, StoryObj } from "@storybook/react";
import { StatusDot } from "./status-dot";
import { Text } from "../text";

/**
 * StatusDot — small colored circle indicating connection state.
 *
 * Green = online, red = offline, amber = warning/degraded.
 * Used in device status bars and health indicators.
 */
const meta: Meta<typeof StatusDot> = {
  title: "UI/Status/StatusDot",
  component: StatusDot,
  tags: ["autodocs"],
  argTypes: {
    status: {
      control: "select",
      options: ["online", "offline", "warning"],
    },
  },
};

export default meta;
type Story = StoryObj<typeof StatusDot>;

export const Primary: Story = {
  args: { status: "online" },
};

export const AllVariants: Story = {
  name: "All Variants",
  parameters: { controls: { disable: true } },
  render: () => (
    <div
      style={{
        display: "flex",
        gap: "var(--ao-spacing-4)",
        alignItems: "center",
        padding: "var(--ao-spacing-4)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "var(--ao-spacing-2)" }}>
        <StatusDot status="online" />
        <Text variant="body">Online</Text>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: "var(--ao-spacing-2)" }}>
        <StatusDot status="offline" />
        <Text variant="body">Offline</Text>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: "var(--ao-spacing-2)" }}>
        <StatusDot status="warning" />
        <Text variant="body">Warning</Text>
      </div>
    </div>
  ),
};

export const ContextDeviceStatus: Story = {
  name: "Context: Device Status Bar",
  parameters: { controls: { disable: true } },
  render: () => (
    <div
      style={{
        display: "flex",
        gap: "var(--ao-spacing-4)",
        padding: "var(--ao-spacing-4)",
        background: "var(--ao-background-secondary)",
        borderRadius: "var(--ao-radius-md)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "var(--ao-spacing-2)" }}>
        <StatusDot status="online" />
        <Text variant="body">Main Gate</Text>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: "var(--ao-spacing-2)" }}>
        <StatusDot status="online" />
        <Text variant="body">Warehouse B</Text>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: "var(--ao-spacing-2)" }}>
        <StatusDot status="offline" />
        <Text variant="body">Office Floor</Text>
      </div>
    </div>
  ),
};

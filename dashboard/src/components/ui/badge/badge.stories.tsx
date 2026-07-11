import type { Meta, StoryObj } from "@storybook/react";
import { Badge } from "./badge";

/**
 * Badge — compact status/count indicators.
 *
 * Used across the app for employee counts, device status,
 * punch event types, and dashboard KPIs.
 */
const meta: Meta<typeof Badge> = {
  title: "UI/Data Display/Badge",
  component: Badge,
  tags: ["autodocs"],
  argTypes: {
    variant: {
      control: "select",
      options: ["success", "danger", "warning", "info", "neutral"],
    },
  },
};

export default meta;
type Story = StoryObj<typeof Badge>;

/** Primary interactive story — used in Docs preview and for control testing. */
export const Primary: Story = {
  args: { variant: "success", children: "Active" },
};

/** All badge variants in a single view. This is the "design review" story. */
export const AllVariants: Story = {
  name: "All Variants",
  parameters: { controls: { disable: true } },
  render: () => (
    <div
      style={{
        display: "flex",
        gap: "var(--ao-spacing-3)",
        flexWrap: "wrap",
        alignItems: "center",
        padding: "var(--ao-spacing-4)",
      }}
    >
      <Badge variant="success">Active</Badge>
      <Badge variant="danger">Offline</Badge>
      <Badge variant="warning">Pending</Badge>
      <Badge variant="info">Check In</Badge>
      <Badge variant="neutral">Draft</Badge>
    </div>
  ),
};

/** Contextual example: device status cards use badges for online/offline. */
export const DeviceStatusExample: Story = {
  name: "Device Status Example",
  parameters: { controls: { disable: true } },
  render: () => (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "var(--ao-spacing-2)",
        padding: "var(--ao-spacing-4)",
        maxWidth: 300,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span>Main Gate</span>
        <Badge variant="success">Online</Badge>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span>Warehouse B</span>
        <Badge variant="success">Online</Badge>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span>Office Floor</span>
        <Badge variant="danger">Offline</Badge>
      </div>
    </div>
  ),
};

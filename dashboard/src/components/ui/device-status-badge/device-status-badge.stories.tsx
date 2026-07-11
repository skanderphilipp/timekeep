import type { Meta, StoryObj } from "@storybook/react";
import { DeviceStatusBadge } from "./device-status-badge";

const meta: Meta<typeof DeviceStatusBadge> = {
  title: "UI/Status/DeviceStatusBadge",
  component: DeviceStatusBadge,
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof DeviceStatusBadge>;

export const Primary: Story = {
  args: { status: "online", pulsing: true },
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
      <DeviceStatusBadge status="online" pulsing />
      <DeviceStatusBadge status="offline" />
      <DeviceStatusBadge status="syncing" />
      <DeviceStatusBadge status="error" />
      <DeviceStatusBadge status="provisioning" />
      <DeviceStatusBadge status="decommissioned" />
    </div>
  ),
};

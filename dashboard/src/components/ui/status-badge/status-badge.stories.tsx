import type { Meta, StoryObj } from "@storybook/react";
import { StatusBadge } from "./status-badge";

/**
 * StatusBadge — dot + label combo for health/status indicators.
 *
 * Used in Settings page for system health, database status,
 * and device protocol indicators (ADMS/SDK).
 */
const meta: Meta<typeof StatusBadge> = {
  title: "UI/Status/StatusBadge",
  component: StatusBadge,
  tags: ["autodocs"],
  argTypes: {
    status: { control: "select", options: ["online", "offline", "warning"] },
    active: { control: "boolean" },
  },
};

export default meta;
type Story = StoryObj<typeof StatusBadge>;

export const Primary: Story = {
  args: { status: "online", label: "Healthy", active: true },
};

/** All status/active combinations in a single matrix view. */
export const AllVariants: Story = {
  name: "All Variants",
  parameters: { controls: { disable: true } },
  render: () => (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--ao-spacing-4)", padding: "var(--ao-spacing-4)" }}>
      <div>
        <h4 style={{ margin: "0 0 var(--ao-spacing-2)" }}>Active</h4>
        <div style={{ display: "flex", gap: "var(--ao-spacing-4)" }}>
          <StatusBadge status="online" label="Online" active />
          <StatusBadge status="offline" label="Offline" active />
          <StatusBadge status="warning" label="Warning" active />
        </div>
      </div>
      <div>
        <h4 style={{ margin: "0 0 var(--ao-spacing-2)" }}>Inactive / Dimmed</h4>
        <div style={{ display: "flex", gap: "var(--ao-spacing-4)" }}>
          <StatusBadge status="online" label="Online" active={false} />
          <StatusBadge status="offline" label="Offline" active={false} />
          <StatusBadge status="warning" label="Warning" active={false} />
        </div>
      </div>
    </div>
  ),
};

/** Real-world: device protocol indicators from the Settings page. */
export const DeviceProtocolsExample: Story = {
  name: "Device Protocols Example",
  parameters: { controls: { disable: true } },
  render: () => (
    <div style={{ display: "flex", gap: "var(--ao-spacing-4)", padding: "var(--ao-spacing-4)", flexWrap: "wrap" }}>
      <div>
        <div style={{ marginBottom: "var(--ao-spacing-1)", fontWeight: 500 }}>Main Gate</div>
        <div style={{ display: "flex", gap: "var(--ao-spacing-3)" }}>
          <StatusBadge status="online" label="ADMS" active />
          <StatusBadge status="online" label="SDK" active />
        </div>
      </div>
      <div>
        <div style={{ marginBottom: "var(--ao-spacing-1)", fontWeight: 500 }}>Warehouse B</div>
        <div style={{ display: "flex", gap: "var(--ao-spacing-3)" }}>
          <StatusBadge status="online" label="ADMS" active />
          <StatusBadge status="offline" label="SDK" active={false} />
        </div>
      </div>
    </div>
  ),
};

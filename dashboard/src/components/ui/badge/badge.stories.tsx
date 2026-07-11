import type { Meta, StoryObj } from "@storybook/react";
import { IconCheck, IconRocket } from "@tabler/icons-react";

import { Badge } from "./badge";

/**
 * Badge — compact status/count indicators.
 *
 * Supports three composition modes:
 * - **Default**: semantic color variant (success, danger, warning, info, neutral)
 * - **Pill**: fully-rounded, uppercase, xx-small ("Soon", "Beta")
 * - **With dot**: status dot prefix for live health indicators
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
    size: {
      control: "select",
      options: ["sm", "md"],
    },
    dot: {
      control: "select",
      options: ["online", "offline", "warning", undefined],
    },
  },
};

export default meta;
type Story = StoryObj<typeof Badge>;

export const Primary: Story = {
  args: { variant: "success", children: "Active" },
};

/** All five semantic variants. */
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

/** Pill mode — fully rounded, uppercase, ideal for "Soon" or "Beta" labels. */
export const PillVariants: Story = {
  name: "Pill Variants",
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
      <Badge pill icon={IconRocket}>
        Soon
      </Badge>
      <Badge pill variant="info">
        Beta
      </Badge>
      <Badge pill variant="success">
        New
      </Badge>
      <Badge pill variant="warning">
        Deprecated
      </Badge>
    </div>
  ),
};

/** Dot mode — status dot prefix for live health indicators. */
export const WithStatusDot: Story = {
  name: "With Status Dot",
  parameters: { controls: { disable: true } },
  render: () => (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "var(--ao-spacing-2)",
        padding: "var(--ao-spacing-4)",
      }}
    >
      <Badge dot="online" variant="success">
        Online
      </Badge>
      <Badge dot="offline" variant="neutral">
        Offline
      </Badge>
      <Badge dot="warning" variant="warning">
        Degraded
      </Badge>
      <Badge dot="online" variant="info">
        Syncing
      </Badge>
      <Badge dot="warning" variant="danger">
        Error
      </Badge>
    </div>
  ),
};

/** Contextual example: device status cards. */
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
        <Badge variant="success" dot="online">
          Online
        </Badge>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span>Warehouse B</span>
        <Badge variant="success" dot="online">
          Online
        </Badge>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span>Office Floor</span>
        <Badge variant="danger" dot="offline">
          Offline
        </Badge>
      </div>
    </div>
  ),
};

/** Size comparison. */
export const Sizes: Story = {
  name: "Sizes",
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
      <Badge size="sm" variant="success">
        Small
      </Badge>
      <Badge size="md" variant="success">
        Medium
      </Badge>
      <Badge size="sm" pill variant="info">
        Small Pill
      </Badge>
      <Badge size="md" pill variant="info">
        Medium Pill
      </Badge>
    </div>
  ),
};

/** With leading icon (from former Pill). */
export const WithIcon: Story = {
  name: "With Icon",
  parameters: { controls: { disable: true } },
  render: () => (
    <div
      style={{
        display: "flex",
        gap: "var(--ao-spacing-3)",
        alignItems: "center",
        padding: "var(--ao-spacing-4)",
      }}
    >
      <Badge icon={IconCheck} variant="success">
        Verified
      </Badge>
      <Badge icon={IconCheck} pill variant="success">
        Done
      </Badge>
    </div>
  ),
};

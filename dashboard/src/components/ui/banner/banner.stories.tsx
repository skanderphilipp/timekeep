import type { Meta, StoryObj } from "@storybook/react";
import { Banner } from "./banner";

/**
 * Banner — contextual alert for info, success, warnings, errors, and neutral tips.
 *
 * Supports title, free-form children, structured description text, dismiss,
 * closable with internal visibility, custom icon override, and an action button.
 * Used on Dashboard ("All devices offline"), Punches ("N anomalies detected"),
 * Settings (save success/error feedback), and API key creation (sensitive data warning).
 */
const meta: Meta<typeof Banner> = {
  title: "UI/Feedback/Banner",
  component: Banner,
  tags: ["autodocs"],
  argTypes: {
    variant: {
      control: "select",
      options: ["info", "success", "warning", "danger", "neutral"],
    },
    closable: { control: "boolean" },
  },
};

export default meta;
type Story = StoryObj<typeof Banner>;

export const Primary: Story = {
  args: {
    variant: "info",
    children: "Attendance data is syncing. Last update: 2 minutes ago.",
  },
};

export const AllVariants: Story = {
  name: "All Variants",
  parameters: { controls: { disable: true } },
  render: () => (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "var(--ao-spacing-4)",
        padding: "var(--ao-spacing-4)",
        maxWidth: 500,
      }}
    >
      <Banner variant="info" title="Information" description="This is an informational message for the user." />
      <Banner variant="success" title="Success" description="Settings have been saved successfully." />
      <Banner variant="warning" title="Warning" description="3 anomalies detected in the current view. Review them before exporting." />
      <Banner variant="danger" title="Error" description="All devices are currently offline. Attendance data may be stale." />
      <Banner variant="neutral" title="Tip" description="Click any employee name to see their full attendance history." />
    </div>
  ),
};

export const SimpleChildren: Story = {
  name: "Simple (children)",
  parameters: { controls: { disable: true } },
  render: () => (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "var(--ao-spacing-3)",
        padding: "var(--ao-spacing-4)",
        maxWidth: 500,
      }}
    >
      <Banner variant="info">Attendance data is syncing. Last update: 2 minutes ago.</Banner>
      <Banner variant="success">Settings saved successfully.</Banner>
      <Banner variant="warning">3 anomalies detected in current view.</Banner>
      <Banner variant="danger">All devices are currently offline. Attendance data may be stale.</Banner>
    </div>
  ),
};

export const Dismissible: Story = {
  name: "Dismissible (onDismiss)",
  parameters: { controls: { disable: true } },
  args: {
    variant: "warning",
    children: "You have unread notifications.",
    onDismiss: () => alert("Dismissed"),
  },
};

export const Closable: Story = {
  name: "Closable (internal state)",
  parameters: { controls: { disable: true } },
  render: () => (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "var(--ao-spacing-3)",
        padding: "var(--ao-spacing-4)",
        maxWidth: 500,
      }}
    >
      <Banner
        variant="warning"
        title="Closable Warning"
        description="This banner can be dismissed with internal visibility tracking."
        closable
        onClose={() => {}}
      />
    </div>
  ),
};

export const WithTitleAndDescription: Story = {
  name: "Title + Description",
  parameters: { controls: { disable: true } },
  args: {
    variant: "info",
    title: "Syncing Attendance Data",
    description: "New records are being pulled from connected devices. This may take a moment.",
  },
};

export const WithAction: Story = {
  name: "With Action Button",
  parameters: { controls: { disable: true } },
  render: () => (
    <div style={{ padding: "var(--ao-spacing-4)", maxWidth: 500 }}>
      <Banner
        variant="warning"
        title="3 Anomalies Detected"
        description="Omar Khalid has 2 duplicate check-ins and 1 orphaned check-out. Review these records before generating the monthly report."
        action={{ label: "Review Anomalies", onClick: () => {} }}
      />
    </div>
  ),
};

export const WithCustomIcon: Story = {
  name: "Custom Icon Override",
  parameters: { controls: { disable: true } },
  args: {
    variant: "info",
    title: "Custom Icon",
    description: "This banner overrides the default info icon with a custom one.",
  },
};

/** Context: dashboard-level system alert for offline devices. */
export const ContextDashboardAlert: Story = {
  name: "Context: Dashboard Alert",
  parameters: { controls: { disable: true } },
  render: () => (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "var(--ao-spacing-3)",
        padding: "var(--ao-spacing-4)",
        maxWidth: 600,
      }}
    >
      <Banner variant="danger" title="Connection Lost">
        Main Gate (192.168.1.101) and Warehouse B (192.168.1.102) are offline. Last sync: 14 minutes
        ago.
      </Banner>
      <Banner variant="warning" title="Sync Delay">
        3 attendance records are pending sync. Data will be transmitted when devices reconnect.
      </Banner>
      <Banner variant="success" title="Backup Complete">
        Database backup saved to S3 at 02:00 UTC. Next backup scheduled in 22 hours.
      </Banner>
    </div>
  ),
};

/** Context: API key creation sensitive-data warning. */
export const ContextApiKeyWarning: Story = {
  name: "Context: API Key Warning",
  parameters: { controls: { disable: true } },
  render: () => (
    <div style={{ padding: "var(--ao-spacing-4)", maxWidth: 500 }}>
      <Banner
        variant="warning"
        title="Important"
        description="Copy this key now. It will not be shown again."
      />
    </div>
  ),
};

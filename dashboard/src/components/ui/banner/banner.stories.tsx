import type { Meta, StoryObj } from "@storybook/react";
import { Banner } from "./banner";

/**
 * Banner — contextual alert for warnings, errors, and status updates.
 *
 * Used on Dashboard ("All devices offline"), Punches ("N anomalies detected"),
 * and Settings (save success/error feedback).
 */
const meta: Meta<typeof Banner> = {
  title: "UI/Feedback/Banner",
  component: Banner,
  tags: ["autodocs"],
  argTypes: {
    variant: {
      control: "select",
      options: ["info", "success", "warning", "danger"],
    },
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
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--ao-spacing-3)", padding: "var(--ao-spacing-4)" }}>
      <Banner variant="info">Attendance data is syncing. Last update: 2 minutes ago.</Banner>
      <Banner variant="success">Settings saved successfully.</Banner>
      <Banner variant="warning">3 anomalies detected in current view.</Banner>
      <Banner variant="danger">All devices are currently offline. Attendance data may be stale.</Banner>
    </div>
  ),
};

export const Dismissible: Story = {
  args: {
    variant: "warning",
    children: "You have unread notifications.",
    onDismiss: () => alert("Dismissed"),
  },
};

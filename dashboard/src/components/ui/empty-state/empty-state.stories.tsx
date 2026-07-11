import type { Meta, StoryObj } from "@storybook/react";
import { EmptyState } from "./empty-state";
import { Button } from "../button";
import { IconPlus } from "@tabler/icons-react";

/**
 * EmptyState — placeholder when a list or view has no data.
 *
 * Every list page must handle the empty case. EmptyState provides
 * a consistent title + description + optional action button.
 */
const meta: Meta<typeof EmptyState> = {
  title: "UI/Feedback/EmptyState",
  component: EmptyState,
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof EmptyState>;

export const Primary: Story = {
  args: {
    title: "No data",
    description: "No records found for the selected period.",
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
        gap: "var(--ao-spacing-6)",
        padding: "var(--ao-spacing-4)",
      }}
    >
      <EmptyState
        title="No devices registered"
        description="Add your first biometric scanner to start collecting attendance data."
        action={<Button icon={<IconPlus size={16} />}>Add Device</Button>}
      />
      <EmptyState
        title="No punch records found"
        description="No punch records match the current filters. Try adjusting or clearing them."
      />
      <EmptyState title="No data" description="No records found for the selected period." />
    </div>
  ),
};

export const ContextNoCheckedIn: Story = {
  name: "Context: No One Checked In",
  parameters: { controls: { disable: true } },
  render: () => (
    <EmptyState
      title="No one currently checked in"
      description="All employees have checked out for the day. Check back tomorrow morning."
    />
  ),
};

export const ContextDevicesOffline: Story = {
  name: "Context: All Devices Offline",
  parameters: { controls: { disable: true } },
  render: () => (
    <EmptyState
      title="All devices offline"
      description="No biometric scanners are currently connected. Attendance data may be stale."
      action={<Button variant="secondary">Troubleshoot</Button>}
    />
  ),
};

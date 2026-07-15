import type { Meta, StoryObj } from "@storybook/react";
import { ActivityFeed } from "./activity-feed";

const NOW = Math.floor(Date.now() / 1000);
const sampleEvents = [
  {
    id: "1",
    label: "Ahmed Al-Sabah checked in at Main Gate via Face",
    timestamp: NOW - 60,
    kind: "online" as const,
  },
  {
    id: "2",
    label: "Omar Khalid checked out at Warehouse B via Card",
    timestamp: NOW - 1020,
    kind: "offline" as const,
    isProblem: true,
  },
  {
    id: "3",
    label: "Device sync completed — 42 records pulled",
    timestamp: NOW - 1800,
    kind: "sync" as const,
  },
  {
    id: "4",
    label: "Office Floor scanner went offline",
    timestamp: NOW - 3600,
    kind: "warning" as const,
    isProblem: true,
  },
  {
    id: "5",
    label: "Fatima Hassan checked in at Main Gate via FP",
    timestamp: NOW - 5400,
    kind: "online" as const,
  },
];

const meta: Meta<typeof ActivityFeed> = {
  title: "UI/Data Display/ActivityFeed",
  component: ActivityFeed,
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof ActivityFeed>;

export const Primary: Story = {
  args: { events: sampleEvents },
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
        maxWidth: 400,
      }}
    >
      <ActivityFeed events={sampleEvents} />
      <ActivityFeed events={[]} emptyMessage="No activity recorded today." />
      <ActivityFeed events={[]} loading />
    </div>
  ),
};

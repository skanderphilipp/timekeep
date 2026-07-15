import type { Meta, StoryObj } from "@storybook/react";
import { Timeline, type TimelineRowData } from "./timeline";

const hourMarkers = ["06:00", "08:00", "10:00", "12:00", "14:00", "16:00", "18:00"];

const sampleRows: TimelineRowData[] = [
  {
    id: "1",
    name: "Ahmed Al-Sabah",
    subLabel: "PIN 145",
    blocks: [
      { left: 32, width: 37, color: "present" as const, title: "Check In 07:42 – Check Out 17:02" },
    ],
  },
  {
    id: "2",
    name: "Fatima Hassan",
    subLabel: "PIN 146",
    blocks: [
      { left: 33, width: 20, color: "present" as const, title: "Check In 07:55" },
      { left: 53, width: 5, color: "warning" as const, title: "Break 12:45 – 13:15" },
      { left: 58, width: 16, color: "present" as const, title: "Check Out 17:05" },
    ],
  },
];

const legendItems = [
  { color: "present" as const, label: "Present" },
  { color: "warning" as const, label: "Break" },
  { color: "overtime" as const, label: "Overtime" },
];

const meta: Meta<typeof Timeline> = {
  title: "UI/Data Display/Timeline",
  component: Timeline,
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof Timeline>;

export const Primary: Story = {
  args: {
    headerLabel: "Employee",
    hourMarkers,
    rows: sampleRows,
    legendItems,
  },
};

export const AllVariants: Story = {
  name: "All Variants",
  parameters: { controls: { disable: true } },
  render: () => (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--ao-spacing-6)" }}>
      <Timeline
        headerLabel="Employee"
        hourMarkers={hourMarkers}
        rows={sampleRows}
        legendItems={legendItems}
      />
      <Timeline
        headerLabel="Employee"
        hourMarkers={hourMarkers}
        rows={[]}
        emptyState={
          <p style={{ padding: 16, color: "var(--ao-font-color-tertiary)" }}>
            No attendance data for today.
          </p>
        }
        legendItems={legendItems}
      />
      <Timeline
        headerLabel="Employee"
        hourMarkers={hourMarkers}
        rows={[]}
        isLoading
        legendItems={legendItems}
      />
    </div>
  ),
};

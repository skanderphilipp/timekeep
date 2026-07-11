import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "storybook/test";
import { ViewBar, type FilterChip } from "./view-bar";
import { IconStatusChange } from "@tabler/icons-react";

const activeFilters: FilterChip[] = [
  { id: "1", label: "Status", value: "Check In", icon: <IconStatusChange size={12} /> },
  { id: "2", label: "Device", value: "Main Gate" },
];

const meta: Meta<typeof ViewBar> = {
  title: "UI/Navigation/ViewBar",
  component: ViewBar,
  tags: ["autodocs"],
  argTypes: {
    viewType: { control: "select", options: ["table", "calendar", "timeline"] },
  },
};

export default meta;
type Story = StoryObj<typeof ViewBar>;

export const Primary: Story = {
  args: {
    viewType: "table",
    onViewTypeChange: fn(),
    totalCount: 128,
  },
};

export const AllVariants: Story = {
  name: "All Variants",
  parameters: { controls: { disable: true } },
  render: () => (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--ao-spacing-6)" }}>
      <ViewBar viewType="table" onViewTypeChange={fn()} totalCount={128} />
      <ViewBar viewType="table" onViewTypeChange={fn()} filters={activeFilters} onRemoveFilter={fn()} onAddFilter={fn()} totalCount={42} />
    </div>
  ),
};

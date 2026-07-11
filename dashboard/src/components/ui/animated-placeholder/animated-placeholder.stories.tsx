import type { Meta, StoryObj } from "@storybook/react";
import { AnimatedPlaceholder } from "./animated-placeholder";

const meta: Meta<typeof AnimatedPlaceholder> = {
  title: "UI/Feedback/AnimatedPlaceholder",
  component: AnimatedPlaceholder,
  tags: ["autodocs"],
  argTypes: {
    type: {
      control: "select",
      options: ["search", "empty", "users", "calendar", "devices", "noResults"],
    },
  },
};

export default meta;
type Story = StoryObj<typeof AnimatedPlaceholder>;

export const Primary: Story = {
  args: {
    type: "empty",
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
        display: "grid",
        gridTemplateColumns: "repeat(3, 1fr)",
        gap: "var(--ao-spacing-4)",
        padding: "var(--ao-spacing-4)",
      }}
    >
      <AnimatedPlaceholder
        type="search"
        title="No results"
        description="Try adjusting your search."
      />
      <AnimatedPlaceholder type="empty" title="No data" description="Nothing here yet." />
      <AnimatedPlaceholder
        type="users"
        title="No employees"
        description="Add your first employee."
      />
      <AnimatedPlaceholder type="calendar" title="No events" description="No attendance records." />
      <AnimatedPlaceholder type="devices" title="No devices" description="Register a scanner." />
      <AnimatedPlaceholder
        type="noResults"
        title="No matches"
        description="Try different filters."
      />
    </div>
  ),
};

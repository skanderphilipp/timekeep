import type { Meta, StoryObj } from "@storybook/react";
import { CalendarMonth } from "./calendar-month";

const meta: Meta<typeof CalendarMonth> = {
  title: "UI/Data Display/CalendarMonth",
  component: CalendarMonth,
  tags: ["autodocs"],
  argTypes: {
    weekStartsOn: { control: "select", options: [0, 1] },
  },
};

export default meta;
type Story = StoryObj<typeof CalendarMonth>;

export const Primary: Story = {
  args: { year: 2026, month: 7 },
};

export const AllVariants: Story = {
  name: "All Variants",
  parameters: { controls: { disable: true } },
  render: () => (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--ao-spacing-6)", maxWidth: 400 }}>
      <CalendarMonth year={2026} month={7} />
      <CalendarMonth
        year={2026}
        month={7}
        renderDay={(day) => (
          <span style={{ fontSize: 11, color: day.isCurrentMonth ? "var(--ao-font-color-secondary)" : "var(--ao-font-color-tertiary)" }}>
            {day.isCurrentMonth ? "8.0h" : ""}
          </span>
        )}
      />
    </div>
  ),
};

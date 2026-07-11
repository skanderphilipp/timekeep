import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "storybook/test";
import { FilterDateRange } from "./filter-date-range";

const meta: Meta<typeof FilterDateRange> = {
  title: "UI/Inputs/FilterDateRange",
  component: FilterDateRange,
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof FilterDateRange>;

export const Primary: Story = {
  args: { label: "Date range", value: "", onChange: fn() },
};

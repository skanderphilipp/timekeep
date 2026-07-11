import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "storybook/test";
import { FilterInput } from "./filter-input";

const meta: Meta<typeof FilterInput> = {
  title: "UI/Inputs/FilterInput",
  component: FilterInput,
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof FilterInput>;

export const Primary: Story = {
  args: { placeholder: "Search by name or PIN…", value: "", onChange: fn() },
};

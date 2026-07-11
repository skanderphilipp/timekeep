import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "storybook/test";
import { SearchInput } from "./search-input";

const meta: Meta<typeof SearchInput> = {
  title: "UI/Inputs/SearchInput",
  component: SearchInput,
  tags: ["autodocs"],
  argTypes: {
    placeholder: { control: "text" },
  },
};

export default meta;
type Story = StoryObj<typeof SearchInput>;

export const Primary: Story = {
  args: { value: "", onChange: fn(), placeholder: "Search by employee name or PIN…" },
};

export const AllVariants: Story = {
  name: "All Variants",
  parameters: { controls: { disable: true } },
  render: () => (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--ao-spacing-4)", padding: "var(--ao-spacing-4)", maxWidth: 350 }}>
      <SearchInput value="" onChange={fn()} placeholder="Search…" />
      <SearchInput value="Ahmed" onChange={fn()} placeholder="Search…" />
    </div>
  ),
};

export const ContextFilterBar: Story = {
  name: "Context: Filter Bar Search",
  parameters: { controls: { disable: true } },
  render: () => (
    <div style={{ padding: "var(--ao-spacing-4)", maxWidth: 400, background: "var(--ao-background-secondary)", borderRadius: "var(--ao-radius-md)" }}>
      <SearchInput value="" onChange={fn()} placeholder="Search by employee name or PIN…" />
    </div>
  ),
};

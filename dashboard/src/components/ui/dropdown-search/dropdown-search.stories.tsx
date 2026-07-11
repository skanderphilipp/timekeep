import type { Meta, StoryObj } from "@storybook/react";
import { DropdownSearch } from "./dropdown-search";
import { fn } from "storybook/test";

const meta: Meta<typeof DropdownSearch> = {
  title: "UI/Overlays/DropdownSearch",
  component: DropdownSearch,
  tags: ["autodocs"],
  argTypes: {
    placeholder: { control: "text" },
  },
};

export default meta;
type Story = StoryObj<typeof DropdownSearch>;

export const Primary: Story = {
  args: { value: "", onChange: fn(), placeholder: "Search employees…" },
};

export const AllVariants: Story = {
  name: "All Variants",
  parameters: { controls: { disable: true } },
  render: () => (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--ao-spacing-4)", padding: "var(--ao-spacing-4)", maxWidth: 300, background: "var(--ao-background-secondary)", borderRadius: "var(--ao-radius-md)" }}>
      <DropdownSearch value="" onChange={fn()} placeholder="Search…" />
      <DropdownSearch value="Ahmed" onChange={fn()} onClear={fn()} placeholder="Search…" />
    </div>
  ),
};

export const ContextInDropdown: Story = {
  name: "Context: Inside Dropdown",
  parameters: { controls: { disable: true } },
  render: () => (
    <div style={{ padding: "var(--ao-spacing-4)", maxWidth: 300, background: "var(--ao-background-primary)", border: "1px solid var(--ao-border-secondary)", borderRadius: "var(--ao-radius-md)" }}>
      <DropdownSearch value="" onChange={fn()} placeholder="Search by name or PIN…" />
      <div style={{ padding: "var(--ao-spacing-2)", fontSize: 13, color: "var(--ao-font-color-secondary)" }}>
        <div style={{ padding: "4px 8px" }}>Ahmed Al-Sabah</div>
        <div style={{ padding: "4px 8px" }}>Fatima Hassan</div>
        <div style={{ padding: "4px 8px" }}>Omar Khalid</div>
      </div>
    </div>
  ),
};

import type { Meta, StoryObj } from "@storybook/react";
import { DropdownSearch } from "./dropdown-search";
import { fn } from "storybook/test";

const meta: Meta<typeof DropdownSearch> = {
  title: "UI/Overlays/DropdownSearch",
  component: DropdownSearch,
  tags: ["autodocs", "level:primitive"],
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
    <div
      style={{
        background: "var(--ao-background-secondary)",
        borderRadius: "var(--ao-radius-md)",
        display: "flex",
        flexDirection: "column",
        gap: "var(--ao-spacing-4)",
        maxWidth: 300,
        padding: "var(--ao-spacing-4)",
      }}
    >
      <DropdownSearch value="" onChange={fn()} placeholder="Search…" />
      <DropdownSearch value="Ahmed" onChange={fn()} onClear={fn()} placeholder="Search…" />
    </div>
  ),
};

export const ContextInDropdown: Story = {
  name: "Context: Inside Dropdown",
  parameters: { controls: { disable: true } },
  render: () => (
    <div
      style={{
        background: "var(--ao-background-primary)",
        border: "1px solid var(--ao-border-color-light)",
        borderRadius: "var(--ao-radius-md)",
        maxWidth: 300,
        padding: "var(--ao-spacing-4)",
      }}
    >
      <DropdownSearch value="" onChange={fn()} placeholder="Search by name or PIN…" />
      <div
        style={{
          color: "var(--ao-font-color-secondary)",
          fontSize: 13,
          padding: "var(--ao-spacing-2)",
        }}
      >
        <div style={{ padding: "4px 8px" }}>Ahmed Al-Sabah</div>
        <div style={{ padding: "4px 8px" }}>Fatima Hassan</div>
        <div style={{ padding: "4px 8px" }}>Omar Khalid</div>
      </div>
    </div>
  ),
};

import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "storybook/test";
import { SearchInput } from "./search-input";

const meta: Meta<typeof SearchInput> = {
  title: "UI/Inputs/SearchInput",
  component: SearchInput,
  tags: ["autodocs"],
  argTypes: {
    placeholder: { control: "text" },
    debounceMs: { control: "number" },
  },
};

export default meta;
type Story = StoryObj<typeof SearchInput>;

export const Immediate: Story = {
  name: "Immediate (default)",
  args: { value: "", onChange: fn(), placeholder: "Search by employee name or PIN…" },
};

export const Debounced: Story = {
  name: "Debounced (300ms)",
  args: {
    value: "",
    onChange: fn(),
    placeholder: "Search with debounce…",
    debounceMs: 300,
  },
};

export const DebouncedLong: Story = {
  name: "Debounced (1000ms)",
  args: {
    value: "",
    onChange: fn(),
    placeholder: "Slow debounce (1s)…",
    debounceMs: 1000,
  },
};

export const AllVariants: Story = {
  name: "All Variants",
  parameters: { controls: { disable: true } },
  render: () => (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "var(--ao-spacing-4)",
        padding: "var(--ao-spacing-4)",
        maxWidth: 350,
      }}
    >
      <SearchInput value="" onChange={fn()} placeholder="Immediate mode…" />
      <SearchInput value="Ahmed" onChange={fn()} placeholder="Immediate with value…" />
      <SearchInput
        value=""
        onChange={fn()}
        placeholder="Debounced mode…"
        debounceMs={300}
      />
      <SearchInput
        value="Mohamed"
        onChange={fn()}
        placeholder="Debounced with value…"
        debounceMs={300}
      />
    </div>
  ),
};

export const ContextFilterBar: Story = {
  name: "Context: Filter Bar Search",
  parameters: { controls: { disable: true } },
  render: () => (
    <div
      style={{
        padding: "var(--ao-spacing-4)",
        maxWidth: 400,
        background: "var(--ao-background-secondary)",
        borderRadius: "var(--ao-radius-md)",
      }}
    >
      <SearchInput
        value=""
        onChange={fn()}
        placeholder="Search by employee name or PIN…"
        debounceMs={300}
      />
    </div>
  ),
};

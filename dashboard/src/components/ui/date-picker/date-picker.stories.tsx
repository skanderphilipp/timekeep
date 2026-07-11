import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "storybook/test";
import { DatePicker } from "./date-picker";

const meta: Meta<typeof DatePicker> = {
  title: "UI/Inputs/DatePicker",
  component: DatePicker,
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof DatePicker>;

export const Primary: Story = {
  args: { value: new Date("2026-07-11"), onChange: fn(), placeholder: "Select date…" },
};

export const AllVariants: Story = {
  name: "All Variants",
  parameters: { controls: { disable: true } },
  render: () => (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--ao-spacing-6)", padding: "var(--ao-spacing-4)" }}>
      <div>
        <p style={{ fontSize: 12, color: "var(--ao-font-color-tertiary)", marginBottom: 8 }}>Single date — selected</p>
        <DatePicker value={new Date("2026-07-11")} onChange={fn()} />
      </div>
      <div>
        <p style={{ fontSize: 12, color: "var(--ao-font-color-tertiary)", marginBottom: 8 }}>Single date — empty</p>
        <DatePicker value={null} onChange={fn()} placeholder="Pick a date…" />
      </div>
      <div>
        <p style={{ fontSize: 12, color: "var(--ao-font-color-tertiary)", marginBottom: 8 }}>Range mode</p>
        <DatePicker mode="range" value={new Date("2026-07-01")} endValue={new Date("2026-07-11")} onChange={fn()} />
      </div>
    </div>
  ),
};

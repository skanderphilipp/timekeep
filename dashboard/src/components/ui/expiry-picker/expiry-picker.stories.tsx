import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "storybook/test";
import { ExpiryPicker } from "./expiry-picker";

const meta: Meta<typeof ExpiryPicker> = {
  title: "UI/Inputs/ExpiryPicker",
  component: ExpiryPicker,
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof ExpiryPicker>;

export const Primary: Story = {
  args: {
    label: "API Key Expiry",
    value: { preset: "never", customDate: null },
    onChange: fn(),
  },
};

export const AllVariants: Story = {
  name: "All Variants",
  parameters: { controls: { disable: true } },
  render: () => (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--ao-spacing-4)", padding: "var(--ao-spacing-4)" }}>
      <ExpiryPicker label="No expiry" value={{ preset: "never", customDate: null }} onChange={fn()} />
      <ExpiryPicker label="30 days" value={{ preset: "30d", customDate: null }} onChange={fn()} />
      <ExpiryPicker label="Custom date" value={{ preset: "custom", customDate: new Date("2026-12-31") }} onChange={fn()} />
    </div>
  ),
};

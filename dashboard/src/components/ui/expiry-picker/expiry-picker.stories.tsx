import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "storybook/test";
import { ExpiryPicker, type ExpiryValue } from "./expiry-picker";

const meta: Meta<typeof ExpiryPicker> = {
  title: "UI/Inputs/ExpiryPicker",
  component: ExpiryPicker,
  tags: ["autodocs", "level:primitive"],
};

export default meta;
type Story = StoryObj<typeof ExpiryPicker>;

function PrimaryDemo() {
  const [value, setValue] = useState<ExpiryValue>({ preset: "never", customDate: null });
  return (
    <div style={{ padding: 20 }}>
      <ExpiryPicker label="API Key Expiry" value={value} onChange={setValue} />
      <div style={{ color: "var(--ao-font-color-tertiary)", fontSize: 12, marginTop: 12 }}>
        Preset: {value.preset}
        {value.customDate ? ` — ${value.customDate.toISOString().split("T")[0]}` : ""}
      </div>
    </div>
  );
}

export const Primary: Story = {
  render: () => <PrimaryDemo />,
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
      }}
    >
      <ExpiryPicker
        label="No expiry"
        value={{ preset: "never", customDate: null }}
        onChange={fn()}
      />
      <ExpiryPicker label="30 days" value={{ preset: "30d", customDate: null }} onChange={fn()} />
      <ExpiryPicker
        label="Custom date"
        value={{ preset: "custom", customDate: new Date("2026-12-31") }}
        onChange={fn()}
      />
    </div>
  ),
};

export const Playground: Story = {
  args: {
    label: "API Key Expiry",
    value: { preset: "never", customDate: null },
    onChange: fn(),
  },
};

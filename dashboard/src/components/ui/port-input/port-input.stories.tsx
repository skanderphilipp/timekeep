import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "storybook/test";
import { PortInput } from "./port-input";

const meta: Meta<typeof PortInput> = {
  title: "UI/Inputs/PortInput",
  component: PortInput,
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof PortInput>;

export const Primary: Story = {
  args: { label: "Port", value: 4370, onChange: fn() },
};

export const AllVariants: Story = {
  name: "All Variants",
  parameters: { controls: { disable: true } },
  render: () => (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--ao-spacing-4)", padding: "var(--ao-spacing-4)", maxWidth: 200 }}>
      <PortInput label="Port" value={4370} onChange={fn()} />
      <PortInput label="Port (error)" error="Port must be 1–65535" onChange={fn()} />
      <PortInput label="Port (disabled)" value={4370} disabled onChange={fn()} />
    </div>
  ),
};

import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "storybook/test";
import { PortInput } from "./port-input";

const meta: Meta<typeof PortInput> = {
  title: "UI/Inputs/PortInput",
  component: PortInput,
  tags: ["autodocs", "level:primitive"],
};

export default meta;
type Story = StoryObj<typeof PortInput>;

function PrimaryDemo() {
  const [port, setPort] = useState(4370);
  return (
    <div style={{ padding: 20 }}>
      <PortInput label="Port" value={port} onChange={setPort} />
      <div style={{ color: "var(--ao-font-color-tertiary)", fontSize: 12, marginTop: 12 }}>
        Current port: {port}
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
        maxWidth: 200,
      }}
    >
      <PortInput label="Port" value={4370} onChange={fn()} />
      <PortInput label="Port (error)" error="Port must be 1–65535" onChange={fn()} />
      <PortInput label="Port (disabled)" value={4370} disabled onChange={fn()} />
    </div>
  ),
};

export const Playground: Story = {
  args: { label: "Port", value: 4370, onChange: fn() },
};

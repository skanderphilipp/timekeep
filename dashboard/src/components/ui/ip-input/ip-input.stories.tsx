import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "storybook/test";
import { IpInput } from "./ip-input";

const meta: Meta<typeof IpInput> = {
  title: "UI/Inputs/IpInput",
  component: IpInput,
  tags: ["autodocs", "level:primitive"],
};

export default meta;
type Story = StoryObj<typeof IpInput>;

export const Primary: Story = {
  args: { label: "IP Address", defaultValue: "192.168.1.100", onChange: fn() },
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
        maxWidth: 300,
      }}
    >
      <IpInput label="IP Address" defaultValue="192.168.1.100" onChange={fn()} />
      <IpInput
        label="IP Address (error)"
        error="Invalid IP address"
        defaultValue="999.999.999.999"
        onChange={fn()}
      />
      <IpInput label="IP Address (disabled)" defaultValue="10.0.0.1" disabled onChange={fn()} />
    </div>
  ),
};

import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "storybook/test";
import { IpPortInput } from "./ip-port-input";

const meta: Meta<typeof IpPortInput> = {
  title: "UI/Inputs/IpPortInput",
  component: IpPortInput,
  tags: ["autodocs", "level:primitive"],
};

export default meta;
type Story = StoryObj<typeof IpPortInput>;

export const Primary: Story = {
  args: {
    label: "Device Address",
    value: { ip: "192.168.1.100", port: 4370 },
    onChange: fn(),
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
      <IpPortInput
        label="Device Address"
        value={{ ip: "192.168.1.100", port: 4370 }}
        onChange={fn()}
      />
      <IpPortInput label="New Device" onChange={fn()} />
      <IpPortInput
        label="Read-only"
        value={{ ip: "10.0.0.1", port: 4370 }}
        disabled
        onChange={fn()}
      />
    </div>
  ),
};

import type { Meta, StoryObj } from "@storybook/react";
import { TintedIconTile } from "./tinted-icon-tile";
import { IconDeviceDesktop, IconUsers, IconClock } from "@tabler/icons-react";

const meta: Meta<typeof TintedIconTile> = {
  title: "UI/Status/TintedIconTile",
  component: TintedIconTile,
  tags: ["autodocs"],
  argTypes: {
    color: { control: "select", options: ["accent", "red", "green", "amber", "blue", "neutral"] },
  },
};

export default meta;
type Story = StoryObj<typeof TintedIconTile>;

export const Primary: Story = {
  args: { Icon: IconDeviceDesktop, size: 24 },
};

export const AllVariants: Story = {
  name: "All Variants",
  parameters: { controls: { disable: true } },
  render: () => (
    <div style={{ display: "flex", gap: "var(--ao-spacing-4)", padding: "var(--ao-spacing-4)" }}>
      <TintedIconTile Icon={IconDeviceDesktop} size={24} />
      <TintedIconTile Icon={IconUsers} size={24} color="green" />
      <TintedIconTile Icon={IconClock} size={24} color="amber" />
    </div>
  ),
};

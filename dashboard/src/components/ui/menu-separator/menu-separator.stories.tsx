import type { Meta, StoryObj } from "@storybook/react";
import { MenuSeparator } from "./menu-separator";
import { MenuItem } from "../menu-item";
import { fn } from "storybook/test";

const meta: Meta<typeof MenuSeparator> = {
  title: "UI/Navigation/MenuSeparator",
  component: MenuSeparator,
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof MenuSeparator>;

export const Primary: Story = {
  render: () => (
    <div style={{ width: 200, border: "1px solid var(--ao-border-secondary)", borderRadius: "var(--ao-radius-md)", overflow: "hidden", padding: 4 }}>
      <MenuItem label="Profile" onClick={fn()} />
      <MenuSeparator />
      <MenuItem label="Sign Out" variant="danger" onClick={fn()} />
    </div>
  ),
};

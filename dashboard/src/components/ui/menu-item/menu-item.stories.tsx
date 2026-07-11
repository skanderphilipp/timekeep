import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "storybook/test";
import { MenuItem } from "./menu-item";
import { IconPencil, IconTrash, IconEye, IconSettings } from "@tabler/icons-react";

const meta: Meta<typeof MenuItem> = {
  title: "UI/Navigation/MenuItem",
  component: MenuItem,
  tags: ["autodocs"],
  argTypes: {
    variant: { control: "select", options: ["default", "danger"] },
  },
};

export default meta;
type Story = StoryObj<typeof MenuItem>;

export const Primary: Story = {
  args: { label: "View Details", onClick: fn() },
};

export const AllVariants: Story = {
  name: "All Variants",
  parameters: { controls: { disable: true } },
  render: () => (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 0,
        width: 220,
        border: "1px solid var(--ao-border-color-light)",
        borderRadius: "var(--ao-radius-md)",
        overflow: "hidden",
        padding: 4,
      }}
    >
      <MenuItem label="View Details" leftIcon={<IconEye size={16} />} onClick={fn()} />
      <MenuItem label="Edit" leftIcon={<IconPencil size={16} />} hotkey="⌘E" onClick={fn()} />
      <MenuItem label="Settings" leftIcon={<IconSettings size={16} />} onClick={fn()} />
      <hr
        style={{
          margin: "2px 0",
          border: "none",
          borderTop: "1px solid var(--ao-border-color-light)",
        }}
      />
      <MenuItem label="Delete" leftIcon={<IconTrash size={16} />} variant="danger" onClick={fn()} />
    </div>
  ),
};

export const ContextUserMenu: Story = {
  name: "Context: User Dropdown",
  parameters: { controls: { disable: true } },
  render: () => (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 0,
        width: 220,
        border: "1px solid var(--ao-border-color-light)",
        borderRadius: "var(--ao-radius-md)",
        overflow: "hidden",
        padding: 4,
      }}
    >
      <MenuItem label="My Profile" onClick={fn()} />
      <MenuItem label="Change Password" onClick={fn()} />
      <hr
        style={{
          margin: "2px 0",
          border: "none",
          borderTop: "1px solid var(--ao-border-color-light)",
        }}
      />
      <MenuItem label="Sign Out" variant="danger" onClick={fn()} />
    </div>
  ),
};

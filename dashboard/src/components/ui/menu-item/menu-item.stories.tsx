import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "storybook/test";
import { MenuItem } from "./menu-item";
import { IconPencil, IconTrash, IconEye, IconSettings } from "@tabler/icons-react";

const meta: Meta<typeof MenuItem> = {
  title: "UI/Navigation/MenuItem",
  component: MenuItem,
  tags: ["autodocs", "level:primitive"],
  argTypes: {
    variant: { control: "select", options: ["default", "danger"] },
  },
};

export default meta;
type Story = StoryObj<typeof MenuItem>;

export const Primary: Story = {
  args: { label: "View Details", onClick: fn() },
};

/**
 * MenuItem renders transparent — it inherits the background of its container.
 * In production, MenuItem lives inside a `<Dropdown>` popup which provides
 * `background: var(--ao-background-primary)`. The story wrappers below replicate
 * that context so the component renders as it would in the real app.
 */
const dropdownSurface: React.CSSProperties = {
  background: "var(--ao-background-primary)",
  border: "1px solid var(--ao-border-color-medium)",
  borderRadius: "var(--ao-radius-md)",
  boxShadow: "var(--ao-shadow-md)",
  display: "flex",
  flexDirection: "column",
  gap: 0,
  overflow: "hidden",
  padding: 4,
  width: 220,
};

export const AllVariants: Story = {
  name: "All Variants",
  parameters: { controls: { disable: true } },
  render: () => (
    <div style={dropdownSurface}>
      <MenuItem label="View Details" leftIcon={<IconEye size={16} />} onClick={fn()} />
      <MenuItem label="Edit" leftIcon={<IconPencil size={16} />} hotkey="⌘E" onClick={fn()} />
      <MenuItem label="Settings" leftIcon={<IconSettings size={16} />} onClick={fn()} />
      <hr
        style={{
          border: "none",
          borderTop: "1px solid var(--ao-border-color-light)",
          margin: "2px 0",
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
    <div style={dropdownSurface}>
      <MenuItem label="My Profile" onClick={fn()} />
      <MenuItem label="Change Password" onClick={fn()} />
      <hr
        style={{
          border: "none",
          borderTop: "1px solid var(--ao-border-color-light)",
          margin: "2px 0",
        }}
      />
      <MenuItem label="Sign Out" variant="danger" onClick={fn()} />
    </div>
  ),
};

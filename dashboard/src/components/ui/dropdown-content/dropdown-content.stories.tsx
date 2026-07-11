import type { Meta, StoryObj } from "@storybook/react";
import { DropdownContent } from "./dropdown-content";
import { MenuItem } from "../menu-item";
import { MenuSeparator } from "../menu-separator";
import { fn } from "storybook/test";

const meta: Meta<typeof DropdownContent> = {
  title: "UI/Overlays/DropdownContent",
  component: DropdownContent,
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof DropdownContent>;

export const Primary: Story = {
  render: () => (
    <div style={{ width: 200 }}>
      <DropdownContent>
        <MenuItem label="View Details" onClick={fn()} />
        <MenuItem label="Edit" onClick={fn()} />
        <MenuSeparator />
        <MenuItem label="Delete" variant="danger" onClick={fn()} />
      </DropdownContent>
    </div>
  ),
};

export const AllVariants: Story = {
  name: "All Variants",
  parameters: { controls: { disable: true } },
  render: () => (
    <div style={{ display: "flex", gap: "var(--ao-spacing-4)", padding: "var(--ao-spacing-4)" }}>
      <div>
        <span
          style={{
            fontSize: 12,
            color: "var(--ao-font-color-tertiary)",
            display: "block",
            marginBottom: 8,
          }}
        >
          Short menu
        </span>
        <DropdownContent>
          <MenuItem label="Profile" onClick={fn()} />
          <MenuItem label="Settings" onClick={fn()} />
          <MenuSeparator />
          <MenuItem label="Sign Out" variant="danger" onClick={fn()} />
        </DropdownContent>
      </div>
      <div>
        <span
          style={{
            fontSize: 12,
            color: "var(--ao-font-color-tertiary)",
            display: "block",
            marginBottom: 8,
          }}
        >
          Long menu
        </span>
        <DropdownContent>
          <MenuItem label="Dashboard" onClick={fn()} />
          <MenuItem label="Punch Records" onClick={fn()} />
          <MenuItem label="Reports" onClick={fn()} />
          <MenuItem label="Employees" onClick={fn()} />
          <MenuItem label="Devices" onClick={fn()} />
          <MenuSeparator />
          <MenuItem label="Settings" onClick={fn()} />
          <MenuItem label="API Keys" onClick={fn()} />
          <MenuItem label="Audit Log" onClick={fn()} />
        </DropdownContent>
      </div>
    </div>
  ),
};

export const ContextUserMenu: Story = {
  name: "Context: User Dropdown",
  parameters: { controls: { disable: true } },
  render: () => (
    <div style={{ width: 220 }}>
      <DropdownContent>
        <MenuItem label="My Profile" onClick={fn()} />
        <MenuItem label="Change Password" onClick={fn()} />
        <MenuSeparator />
        <MenuItem label="Sign Out" variant="danger" onClick={fn()} />
      </DropdownContent>
    </div>
  ),
};

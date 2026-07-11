import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "storybook/test";
import { Dropdown } from "./dropdown";
import { DropdownContent } from "../dropdown-content";
import { MenuItem } from "../menu-item";
import { MenuSeparator } from "../menu-separator";
import { Button } from "../button";

const meta: Meta<typeof Dropdown> = {
  title: "UI/Overlays/Dropdown",
  component: Dropdown,
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof Dropdown>;

export const Primary: Story = {
  render: () => (
    <div style={{ padding: 20 }}>
      <Dropdown trigger={<Button variant="secondary">Actions</Button>}>
        <DropdownContent>
          <MenuItem label="View Details" onClick={fn()} />
          <MenuItem label="Edit" onClick={fn()} />
          <MenuSeparator />
          <MenuItem label="Delete" variant="danger" onClick={fn()} />
        </DropdownContent>
      </Dropdown>
    </div>
  ),
};

export const AllVariants: Story = {
  name: "All Variants",
  parameters: { controls: { disable: true } },
  render: () => (
    <div style={{ display: "flex", gap: "var(--ao-spacing-4)", padding: 20 }}>
      <Dropdown trigger={<Button variant="secondary" size="sm">User Menu</Button>}>
        <DropdownContent>
          <MenuItem label="Profile" onClick={fn()} />
          <MenuItem label="Settings" onClick={fn()} />
          <MenuSeparator />
          <MenuItem label="Sign Out" variant="danger" onClick={fn()} />
        </DropdownContent>
      </Dropdown>
      <Dropdown trigger={<Button variant="secondary" size="sm">Filter</Button>}>
        <DropdownContent>
          <MenuItem label="Today" onClick={fn()} />
          <MenuItem label="This Week" onClick={fn()} />
          <MenuItem label="This Month" onClick={fn()} />
        </DropdownContent>
      </Dropdown>
    </div>
  ),
};

import type { Meta, StoryObj } from "@storybook/react";
import { MenuItemNavigate } from "./menu-item-navigate";
import { IconChartBar, IconUsers, IconSettings } from "@tabler/icons-react";

const meta: Meta<typeof MenuItemNavigate> = {
  title: "UI/Navigation/MenuItemNavigate",
  component: MenuItemNavigate,
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof MenuItemNavigate>;

export const Primary: Story = {
  args: { label: "Reports", to: "/reports", leftIcon: <IconChartBar size={16} /> },
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
      <MenuItemNavigate label="Dashboard" to="/" leftIcon={<IconChartBar size={16} />} />
      <MenuItemNavigate label="Employees" to="/employees" leftIcon={<IconUsers size={16} />} />
      <MenuItemNavigate label="Settings" to="/settings" leftIcon={<IconSettings size={16} />} />
    </div>
  ),
};

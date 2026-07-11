import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "storybook/test";
import { Button } from "./button";
import { IconPlus, IconRefresh, IconTrash } from "@tabler/icons-react";

/**
 * Button — the primary action trigger.
 *
 * Four variants (primary, secondary, danger, ghost), two sizes (sm, md),
 * plus loading/disabled/full-width states.
 */
const meta: Meta<typeof Button> = {
  title: "UI/Actions/Button",
  component: Button,
  tags: ["autodocs"],
  argTypes: {
    variant: {
      control: "select",
      options: ["primary", "secondary", "danger", "ghost"],
    },
    size: {
      control: "select",
      options: ["sm", "md"],
    },
    disabled: { control: "boolean" },
    loading: { control: "boolean" },
    fullWidth: { control: "boolean" },
  },
  args: {
    onClick: fn(),
  },
};

export default meta;
type Story = StoryObj<typeof Button>;

export const Primary: Story = {
  args: {
    children: "Save Changes",
    variant: "primary",
    size: "md",
  },
};

export const AllVariants: Story = {
  name: "All Variants",
  parameters: { controls: { disable: true } },
  render: () => (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--ao-spacing-4)", padding: "var(--ao-spacing-4)" }}>
      <div style={{ display: "flex", gap: "var(--ao-spacing-2)", alignItems: "center", flexWrap: "wrap" }}>
        <Button variant="primary">Primary</Button>
        <Button variant="secondary">Secondary</Button>
        <Button variant="danger">Danger</Button>
        <Button variant="ghost">Ghost</Button>
      </div>
      <div style={{ display: "flex", gap: "var(--ao-spacing-2)", alignItems: "center", flexWrap: "wrap" }}>
        <Button variant="primary" size="sm">Small</Button>
        <Button variant="secondary" size="sm">Small</Button>
        <Button variant="danger" size="sm">Small</Button>
        <Button variant="ghost" size="sm">Small</Button>
      </div>
      <div style={{ display: "flex", gap: "var(--ao-spacing-2)", alignItems: "center", flexWrap: "wrap" }}>
        <Button variant="primary" disabled>Disabled</Button>
        <Button variant="secondary" disabled>Disabled</Button>
        <Button variant="danger" disabled>Disabled</Button>
      </div>
      <div style={{ display: "flex", gap: "var(--ao-spacing-2)", alignItems: "center", flexWrap: "wrap" }}>
        <Button variant="primary" loading>Loading</Button>
        <Button variant="secondary" loading>Loading</Button>
      </div>
      <div>
        <Button variant="primary" fullWidth>Full Width</Button>
      </div>
    </div>
  ),
};

export const ContextToolbar: Story = {
  name: "Context: Toolbar Actions",
  parameters: { controls: { disable: true } },
  render: () => (
    <div style={{ display: "flex", gap: "var(--ao-spacing-2)", padding: "var(--ao-spacing-4)", background: "var(--ao-background-secondary)", borderRadius: "var(--ao-radius-md)" }}>
      <Button variant="primary" icon={<IconPlus size={16} />}>Add Employee</Button>
      <Button variant="secondary" icon={<IconRefresh size={16} />}>Refresh</Button>
      <Button variant="danger" icon={<IconTrash size={16} />}>Delete</Button>
      <Button variant="ghost">Cancel</Button>
    </div>
  ),
};

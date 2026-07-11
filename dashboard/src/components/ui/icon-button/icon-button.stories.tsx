import type { Meta, StoryObj } from "@storybook/react";
import { IconButton } from "./icon-button";
import { ActionGroup } from "../action-group";
import { IconPencil, IconTrash, IconEye, IconPlus } from "@tabler/icons-react";

const meta: Meta<typeof IconButton> = {
  title: "UI/Actions/IconButton",
  component: IconButton,
  tags: ["autodocs"],
  argTypes: {
    size: { control: "select", options: ["sm", "md"] },
    accent: { control: "select", options: ["primary", "secondary", "tertiary"] },
  },
};

export default meta;
type Story = StoryObj<typeof IconButton>;

export const Primary: Story = {
  args: { "aria-label": "Edit", children: <IconPencil size={16} />, accent: "secondary" },
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
      }}
    >
      <div style={{ display: "flex", gap: "var(--ao-spacing-2)", alignItems: "center" }}>
        <IconButton aria-label="View">
          <IconEye size={16} />
        </IconButton>
        <IconButton aria-label="Edit">
          <IconPencil size={16} />
        </IconButton>
        <IconButton aria-label="Delete">
          <IconTrash size={16} />
        </IconButton>
        <span style={{ fontSize: 12, color: "var(--ao-font-color-tertiary)" }}>
          md / secondary (default)
        </span>
      </div>
      <div style={{ display: "flex", gap: "var(--ao-spacing-2)", alignItems: "center" }}>
        <IconButton aria-label="View" size="sm">
          <IconEye size={14} />
        </IconButton>
        <IconButton aria-label="Edit" size="sm">
          <IconPencil size={14} />
        </IconButton>
        <IconButton aria-label="Delete" size="sm">
          <IconTrash size={14} />
        </IconButton>
        <span style={{ fontSize: 12, color: "var(--ao-font-color-tertiary)" }}>sm / secondary</span>
      </div>
      <div style={{ display: "flex", gap: "var(--ao-spacing-2)", alignItems: "center" }}>
        <IconButton aria-label="Primary" accent="primary">
          <IconPlus size={16} />
        </IconButton>
        <IconButton aria-label="Secondary" accent="secondary">
          <IconPencil size={16} />
        </IconButton>
        <IconButton aria-label="Tertiary" accent="tertiary">
          <IconTrash size={16} />
        </IconButton>
        <span style={{ fontSize: 12, color: "var(--ao-font-color-tertiary)" }}>
          primary / secondary / tertiary
        </span>
      </div>
    </div>
  ),
};

export const ContextTableActions: Story = {
  name: "Context: Table Row Actions",
  parameters: { controls: { disable: true } },
  render: () => (
    <ActionGroup>
      <IconButton aria-label="View details">
        <IconEye size={16} />
      </IconButton>
      <IconButton aria-label="Edit employee">
        <IconPencil size={16} />
      </IconButton>
      <IconButton aria-label="Delete employee" accent="tertiary">
        <IconTrash size={16} />
      </IconButton>
    </ActionGroup>
  ),
};

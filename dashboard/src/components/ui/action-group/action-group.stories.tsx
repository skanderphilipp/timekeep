import type { Meta, StoryObj } from "@storybook/react";
import { ActionGroup } from "./action-group";
import { IconButton } from "../icon-button";
import { IconPencil, IconTrash, IconEye } from "@tabler/icons-react";

const meta: Meta<typeof ActionGroup> = {
  title: "UI/Actions/ActionGroup",
  component: ActionGroup,
  tags: ["autodocs", "level:primitive"],
};

export default meta;
type Story = StoryObj<typeof ActionGroup>;

export const Primary: Story = {
  render: () => (
    <ActionGroup>
      <IconButton aria-label="View">
        <IconEye size={16} />
      </IconButton>
      <IconButton aria-label="Edit">
        <IconPencil size={16} />
      </IconButton>
      <IconButton aria-label="Delete">
        <IconTrash size={16} />
      </IconButton>
    </ActionGroup>
  ),
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
      <ActionGroup>
        <IconButton aria-label="View">
          <IconEye size={16} />
        </IconButton>
        <IconButton aria-label="Edit">
          <IconPencil size={16} />
        </IconButton>
      </ActionGroup>
      <ActionGroup>
        <IconButton aria-label="View">
          <IconEye size={16} />
        </IconButton>
        <IconButton aria-label="Edit">
          <IconPencil size={16} />
        </IconButton>
        <IconButton aria-label="Delete">
          <IconTrash size={16} />
        </IconButton>
      </ActionGroup>
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
      <IconButton aria-label="Delete employee">
        <IconTrash size={16} />
      </IconButton>
    </ActionGroup>
  ),
};

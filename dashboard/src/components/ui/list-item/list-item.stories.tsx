import type { Meta, StoryObj } from "@storybook/react";
import { ListItem } from "./list-item";
import { Text } from "../text";
import { Badge } from "../badge";
import { StatusDot } from "../status-dot";

/**
 * ListItem — a single row in a list with leading and trailing content.
 *
 * Used in CheckedInList (dashboard), punch detail panels,
 * and any vertical list of items with metadata.
 */
const meta: Meta<typeof ListItem> = {
  title: "UI/Data Display/ListItem",
  component: ListItem,
  tags: ["autodocs", "level:primitive"],
};

export default meta;
type Story = StoryObj<typeof ListItem>;

export const Primary: Story = {
  render: () => (
    <ListItem>
      <ListItem.Leading>
        <Text variant="body" weight="medium">
          Ahmed Al-Sabah
        </Text>
        <Text variant="caption" color="tertiary">
          07:42 · Main Gate
        </Text>
      </ListItem.Leading>
      <ListItem.Trailing>
        <Text variant="body" color="secondary">
          6h 50m
        </Text>
      </ListItem.Trailing>
    </ListItem>
  ),
};

export const AllVariants: Story = {
  name: "All Variants",
  parameters: { controls: { disable: true } },
  render: () => (
    <div style={{ display: "flex", flexDirection: "column", gap: 0, maxWidth: 400 }}>
      <ListItem>
        <ListItem.Leading>
          <Text variant="body" weight="medium">
            Checked-in Employee
          </Text>
          <Text variant="caption" color="tertiary">
            07:42 · Main Gate
          </Text>
        </ListItem.Leading>
        <ListItem.Trailing>
          <Text variant="body" color="secondary">
            6h 50m
          </Text>
        </ListItem.Trailing>
      </ListItem>
      <ListItem>
        <ListItem.Leading>
          <Text variant="body" weight="medium">
            Recent Activity
          </Text>
        </ListItem.Leading>
        <ListItem.Trailing>
          <Badge variant="success">Check In</Badge>
          <Text variant="caption" color="tertiary">
            2m ago
          </Text>
        </ListItem.Trailing>
      </ListItem>
      <ListItem>
        <ListItem.Leading>
          <Text variant="body" weight="medium">
            Device Status
          </Text>
        </ListItem.Leading>
        <ListItem.Trailing>
          <StatusDot status="online" />
          <Text variant="caption">Online</Text>
        </ListItem.Trailing>
      </ListItem>
    </div>
  ),
};

export const ContextCheckedInList: Story = {
  name: "Context: Checked-In Employees",
  parameters: { controls: { disable: true } },
  render: () => (
    <div style={{ maxWidth: 400 }}>
      <ListItem>
        <ListItem.Leading>
          <Text variant="body" weight="medium">
            Ahmed Al-Sabah
          </Text>
          <Text variant="caption" color="tertiary">
            07:42 · Main Gate
          </Text>
        </ListItem.Leading>
        <ListItem.Trailing>
          <Text variant="body" color="secondary">
            6h 50m
          </Text>
        </ListItem.Trailing>
      </ListItem>
      <ListItem>
        <ListItem.Leading>
          <Text variant="body" weight="medium">
            Fatima Hassan
          </Text>
          <Text variant="caption" color="tertiary">
            07:55 · Main Gate
          </Text>
        </ListItem.Leading>
        <ListItem.Trailing>
          <Text variant="body" color="secondary">
            6h 37m
          </Text>
        </ListItem.Trailing>
      </ListItem>
      <ListItem>
        <ListItem.Leading>
          <Text variant="body" weight="medium">
            Omar Khalid
          </Text>
          <Text variant="caption" color="tertiary">
            08:02 · Warehouse B
          </Text>
        </ListItem.Leading>
        <ListItem.Trailing>
          <Text variant="body" color="secondary">
            6h 30m
          </Text>
        </ListItem.Trailing>
      </ListItem>
    </div>
  ),
};

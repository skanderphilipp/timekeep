import type { Meta, StoryObj } from "@storybook/react";
import { Card } from "./card";
import { Badge } from "../badge";
import { Text } from "../text";

/**
 * Card — the primary content container.
 *
 * Used everywhere: metric cards, lists, charts, forms.
 * Compose with Card.Header, Card.Content for consistent layout.
 */
const meta: Meta<typeof Card> = {
  title: "UI/Layout/Card",
  component: Card,
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof Card>;

export const Primary: Story = {
  render: () => (
    <Card>
      <Card.Header title="System Health" subtitle="Current status of all system components." />
      <Card.Content>
        <Text variant="body">Dashboard content goes here. Use Card.Content for consistent padding.</Text>
      </Card.Content>
    </Card>
  ),
};

export const AllVariants: Story = {
  name: "All Variants",
  parameters: { controls: { disable: true } },
  render: () => (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--ao-spacing-4)", padding: "var(--ao-spacing-4)" }}>
      <Card>
        <Card.Content>
          <Text variant="body">Plain card — just content, no header.</Text>
        </Card.Content>
      </Card>
      <Card>
        <Card.Header title="With Header" action={<Badge variant="success">42</Badge>} />
        <Card.Content>
          <Text variant="body">Card with header and badge action.</Text>
        </Card.Content>
      </Card>
      <Card clickable tabIndex={0} role="button" onClick={() => {}}>
        <Card.Content>
          <Badge variant="success">Online</Badge>
          <Text variant="body" weight="medium">Main Gate</Text>
          <Text variant="caption" color="tertiary">SN: CQZ7232960836</Text>
        </Card.Content>
      </Card>
    </div>
  ),
};

export const ContextCurrentlyCheckedIn: Story = {
  name: "Context: Currently Checked In",
  parameters: { controls: { disable: true } },
  render: () => (
    <Card>
      <Card.Header
        title="Currently Checked In"
        action={<Badge variant="success">42</Badge>}
      />
      <Card.Content>
        <Text variant="body" color="secondary">
          42 employees currently on-site. Last check-in 30 seconds ago.
        </Text>
      </Card.Content>
    </Card>
  ),
};

import type { Meta, StoryObj } from "@storybook/react";
import { Card } from "../card";
import { Text } from "../text";
import { CardGrid } from "./card-grid";

const meta: Meta<typeof CardGrid> = {
  title: "UI/Layout/CardGrid",
  component: CardGrid,
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof CardGrid>;

export const Primary: Story = {
  render: () => (
    <CardGrid>
      {[1, 2, 3, 4].map((i) => (
        <Card key={i}>
          <Card.Content>
            <Text variant="body" weight="medium">
              Card {i}
            </Text>
            <Text variant="caption" color="tertiary">
              Grid column content
            </Text>
          </Card.Content>
        </Card>
      ))}
    </CardGrid>
  ),
};

export const AllVariants: Story = {
  name: "All Variants",
  parameters: { controls: { disable: true } },
  render: () => (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--ao-spacing-6)" }}>
      <div>
        <span
          style={{
            fontSize: 12,
            color: "var(--ao-font-color-tertiary)",
            display: "block",
            marginBottom: 8,
          }}
        >
          2 columns
        </span>
        <CardGrid>
          {[1, 2].map((i) => (
            <Card key={i}>
              <Card.Content>
                <Text variant="body">Item {i}</Text>
              </Card.Content>
            </Card>
          ))}
        </CardGrid>
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
          4 columns
        </span>
        <CardGrid>
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <Card.Content>
                <Text variant="body">Item {i}</Text>
              </Card.Content>
            </Card>
          ))}
        </CardGrid>
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
          3 columns (odd count)
        </span>
        <CardGrid>
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <Card.Content>
                <Text variant="body">Item {i}</Text>
              </Card.Content>
            </Card>
          ))}
        </CardGrid>
      </div>
    </div>
  ),
};

export const ContextMetricCards: Story = {
  name: "Context: Dashboard Metrics",
  parameters: { controls: { disable: true } },
  render: () => (
    <CardGrid>
      <Card>
        <Card.Content>
          <Text variant="body" weight="medium">
            Present
          </Text>
          <Text variant="body" weight="medium" color="success">
            42
          </Text>
        </Card.Content>
      </Card>
      <Card>
        <Card.Content>
          <Text variant="body" weight="medium">
            Absent
          </Text>
          <Text variant="body" weight="medium" color="danger">
            8
          </Text>
        </Card.Content>
      </Card>
      <Card>
        <Card.Content>
          <Text variant="body" weight="medium">
            Late
          </Text>
          <Text variant="body" weight="medium" color="warning">
            3
          </Text>
        </Card.Content>
      </Card>
      <Card>
        <Card.Content>
          <Text variant="body" weight="medium">
            On Time
          </Text>
          <Text variant="body" weight="medium" color="success">
            39
          </Text>
        </Card.Content>
      </Card>
    </CardGrid>
  ),
};

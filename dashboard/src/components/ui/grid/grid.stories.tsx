import type { Meta, StoryObj } from "@storybook/react";
import { Grid } from "./grid";
import { Card } from "../card";
import { Text } from "../text";

const meta: Meta<typeof Grid> = {
  title: "UI/Layout/Grid",
  component: Grid,
  tags: ["autodocs", "level:primitive"],
  argTypes: {
    cols: { control: "select", options: [2, "auto"] },
  },
};

export default meta;
type Story = StoryObj<typeof Grid>;

export const Primary: Story = {
  render: () => (
    <Grid cols={2}>
      <Card>
        <Card.Content>
          <Text variant="body">Column 1</Text>
        </Card.Content>
      </Card>
      <Card>
        <Card.Content>
          <Text variant="body">Column 2</Text>
        </Card.Content>
      </Card>
    </Grid>
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
            color: "var(--ao-font-color-tertiary)",
            display: "block",
            fontSize: 12,
            marginBottom: 8,
          }}
        >
          cols=2
        </span>
        <Grid cols={2}>
          <Card>
            <Card.Content>
              <Text variant="body">Item 1</Text>
            </Card.Content>
          </Card>
          <Card>
            <Card.Content>
              <Text variant="body">Item 2</Text>
            </Card.Content>
          </Card>
        </Grid>
      </div>
      <div>
        <span
          style={{
            color: "var(--ao-font-color-tertiary)",
            display: "block",
            fontSize: 12,
            marginBottom: 8,
          }}
        >
          cols=auto (3 items)
        </span>
        <Grid cols="auto">
          <Card>
            <Card.Content>
              <Text variant="body">Item 1</Text>
            </Card.Content>
          </Card>
          <Card>
            <Card.Content>
              <Text variant="body">Item 2</Text>
            </Card.Content>
          </Card>
          <Card>
            <Card.Content>
              <Text variant="body">Item 3</Text>
            </Card.Content>
          </Card>
        </Grid>
      </div>
    </div>
  ),
};

export const ContextChartPair: Story = {
  name: "Context: Dashboard Charts",
  parameters: { controls: { disable: true } },
  render: () => (
    <Grid cols={2}>
      <Card>
        <Card.Header title="Hourly Arrivals" />
        <Card.Content>
          <Text variant="body" color="secondary">
            Bar chart of check-ins per hour.
          </Text>
        </Card.Content>
      </Card>
      <Card>
        <Card.Header title="Recent Activity" />
        <Card.Content>
          <Text variant="body" color="secondary">
            Activity feed of recent punches.
          </Text>
        </Card.Content>
      </Card>
    </Grid>
  ),
};

import type { Meta, StoryObj } from "@storybook/react";
import { Spinner } from "./spinner";
import { Card } from "../card";
import { Text } from "../text";

/**
 * Spinner — indeterminate loading indicator.
 *
 * Shown while data is being fetched. Use inside Section or Card
 * for consistent placement.
 */
const meta: Meta<typeof Spinner> = {
  title: "UI/Feedback/Spinner",
  component: Spinner,
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof Spinner>;

export const Primary: Story = {};

export const AllVariants: Story = {
  name: "All Variants",
  parameters: { controls: { disable: true } },
  render: () => (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--ao-spacing-6)", padding: "var(--ao-spacing-4)" }}>
      <div>
        <Text variant="caption" color="tertiary" style={{ marginBottom: 8, display: "block" }}>Default</Text>
        <div style={{ display: "flex", justifyContent: "center", padding: "var(--ao-spacing-8)" }}>
          <Spinner />
        </div>
      </div>
      <div>
        <Text variant="caption" color="tertiary" style={{ marginBottom: 8, display: "block" }}>In Card</Text>
        <Card>
          <Card.Content>
            <div style={{ display: "flex", justifyContent: "center", padding: "var(--ao-spacing-4)" }}>
              <Spinner />
            </div>
          </Card.Content>
        </Card>
      </div>
    </div>
  ),
};

export const ContextPageLoading: Story = {
  name: "Context: Page Loading",
  parameters: { controls: { disable: true } },
  render: () => (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "var(--ao-spacing-16)", gap: "var(--ao-spacing-4)" }}>
      <Spinner />
      <Text variant="body" color="secondary">Loading dashboard data…</Text>
    </div>
  ),
};

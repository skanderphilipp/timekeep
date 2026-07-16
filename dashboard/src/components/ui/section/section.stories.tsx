import type { Meta, StoryObj } from "@storybook/react";
import { Section } from "./section";
import { Text } from "../text";
import { Card } from "../card";

const meta: Meta<typeof Section> = {
  title: "UI/Layout/Section",
  component: Section,
  tags: ["autodocs", "level:primitive"],
  argTypes: {
    alignment: { control: "select", options: ["left", "center"] },
  },
};

export default meta;
type Story = StoryObj<typeof Section>;

export const Primary: Story = {
  render: () => (
    <div>
      <Section>
        <Text variant="body">
          Section 1 — each Section provides consistent vertical rhythm and horizontal padding.
        </Text>
      </Section>
      <Section>
        <Text variant="body">
          Section 2 — content blocks should be separated by Sections, not raw divs.
        </Text>
      </Section>
    </div>
  ),
};

export const AllVariants: Story = {
  name: "All Variants",
  parameters: { controls: { disable: true } },
  render: () => (
    <div>
      <Section alignment="left">
        <Card>
          <Card.Content>
            <Text variant="body" weight="medium">
              Left-aligned section
            </Text>
            <Text variant="caption" color="tertiary">
              Default alignment for most content.
            </Text>
          </Card.Content>
        </Card>
      </Section>
      <Section alignment="center">
        <Card>
          <Card.Content>
            <Text variant="body" weight="medium">
              Center-aligned section
            </Text>
            <Text variant="caption" color="tertiary">
              Used for empty states, error pages, login forms.
            </Text>
          </Card.Content>
        </Card>
      </Section>
    </div>
  ),
};

export const ContextPageContent: Story = {
  name: "Context: Page Content Blocks",
  parameters: { controls: { disable: true } },
  render: () => (
    <div>
      <Section>
        <Text variant="body" weight="medium">
          Dashboard Metrics
        </Text>
        <Text variant="caption" color="tertiary">
          4 metric cards would render here.
        </Text>
      </Section>
      <Section>
        <Text variant="body" weight="medium">
          Currently Checked In
        </Text>
        <Text variant="caption" color="tertiary">
          Checked-in employee list would render here.
        </Text>
      </Section>
      <Section>
        <Text variant="body" weight="medium">
          Device Status
        </Text>
        <Text variant="caption" color="tertiary">
          Device health indicators would render here.
        </Text>
      </Section>
    </div>
  ),
};

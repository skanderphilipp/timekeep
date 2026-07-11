import type { Meta, StoryObj } from "@storybook/react";
import { PageBody } from "./page-body";
import { Text } from "../text";
import { Section } from "../section";
import { Card } from "../card";

const meta: Meta<typeof PageBody> = {
  title: "UI/Layout/PageBody",
  component: PageBody,
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof PageBody>;

export const Primary: Story = {
  render: () => (
    <PageBody>
      <Section>
        <Card>
          <Card.Content>
            <Text variant="body">
              Content inside PageBody. Use Section for vertical rhythm and Card for visual grouping.
            </Text>
          </Card.Content>
        </Card>
      </Section>
      <Section>
        <Card>
          <Card.Content>
            <Text variant="body">Second section below the first.</Text>
          </Card.Content>
        </Card>
      </Section>
    </PageBody>
  ),
};

import type { Meta, StoryObj } from "@storybook/react";
import { PageLayout } from "./page-layout";
import { PageHeader } from "../page-header";
import { PageBody } from "../page-body";
import { Section } from "../section";
import { Text } from "../text";
import { Button } from "../button";
import { IconPlus } from "@tabler/icons-react";

const meta: Meta<typeof PageLayout> = {
  title: "UI/Layout/PageLayout",
  component: PageLayout,
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof PageLayout>;

export const Primary: Story = {
  render: () => (
    <PageLayout>
      <PageHeader title="Devices" description="Manage ZKTeco biometric scanners and attendance terminals." />
      <PageBody>
        <Section>
          <Text variant="body">Page content goes here. Use PageLayout as the outer wrapper, PageHeader for the title, and PageBody for content sections.</Text>
        </Section>
      </PageBody>
    </PageLayout>
  ),
};

export const AllVariants: Story = {
  name: "All Variants",
  parameters: { controls: { disable: true } },
  render: () => (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--ao-spacing-8)" }}>
      <PageLayout>
        <PageHeader title="Simple Page" />
        <PageBody>
          <Section><Text variant="body">No description, no actions.</Text></Section>
        </PageBody>
      </PageLayout>
      <PageLayout>
        <PageHeader
          title="With Actions"
          description="This page has action buttons in the header."
          actions={<Button icon={<IconPlus size={16} />}>Add Item</Button>}
        />
        <PageBody>
          <Section><Text variant="body">Content with header actions.</Text></Section>
        </PageBody>
      </PageLayout>
    </div>
  ),
};

export const ContextDashboardPage: Story = {
  name: "Context: Dashboard Page Shell",
  parameters: { controls: { disable: true } },
  render: () => (
    <PageLayout>
      <PageHeader title="Dashboard" description="Who is here right now?" />
      <PageBody>
        <Section><Text variant="body">Live attendance overview — metrics, checked-in list, charts.</Text></Section>
        <Section><Text variant="body" color="tertiary">Device status footer.</Text></Section>
      </PageBody>
    </PageLayout>
  ),
};

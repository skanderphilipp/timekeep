import type { Meta, StoryObj } from "@storybook/react";
import { PageBar } from "./page-bar";
import { Button } from "@/components/ui/button";
import { IconPlus } from "@tabler/icons-react";

const meta: Meta<typeof PageBar> = {
  title: "UI/Layout/PageBar",
  component: PageBar,
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof PageBar>;

export const Primary: Story = {
  args: { title: "Devices", description: "Manage ZKTeco biometric scanners." },
};

export const AllVariants: Story = {
  name: "All Variants",
  parameters: { controls: { disable: true } },
  render: () => (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--ao-spacing-8)" }}>
      <PageBar title="Simple Title" />
      <PageBar
        title="Employees"
        description="View and manage all employees."
        actions={<Button icon={<IconPlus size={16} />}>Add Employee</Button>}
      />
      <PageBar
        title="Fatima Hassan"
        description="Employee detail view."
        actions={<Button variant="secondary" size="sm">Edit</Button>}
      />
    </div>
  ),
};

import type { Meta, StoryObj } from "@storybook/react";
import { PageHeader } from "./page-header";
import { Button } from "../button";
import { IconPlus } from "@tabler/icons-react";

const meta: Meta<typeof PageHeader> = {
  title: "UI/Layout/PageHeader",
  component: PageHeader,
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof PageHeader>;

export const Primary: Story = {
  args: { title: "Devices", description: "Manage ZKTeco biometric scanners and attendance terminals." },
};

export const AllVariants: Story = {
  name: "All Variants",
  parameters: { controls: { disable: true } },
  render: () => (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--ao-spacing-8)" }}>
      <PageHeader title="Simple Title" />
      <PageHeader title="With Description" description="This page shows attendance data for the selected period." />
      <PageHeader
        title="With Actions"
        description="Manage dashboard users, roles, and passwords."
        actions={<Button icon={<IconPlus size={16} />}>Add User</Button>}
      />
    </div>
  ),
};

export const ContextEmployeePage: Story = {
  name: "Context: Employee Directory",
  parameters: { controls: { disable: true } },
  render: () => (
    <PageHeader
      title="Employees"
      description="View and manage all employees. Click a name to see detailed attendance history."
      actions={<Button icon={<IconPlus size={16} />}>Add Employee</Button>}
    />
  ),
};

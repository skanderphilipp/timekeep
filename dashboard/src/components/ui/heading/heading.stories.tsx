import type { Meta, StoryObj } from "@storybook/react";
import { Heading } from "./heading";
import { IconDeviceDesktop, IconUsers, IconChartBar } from "@tabler/icons-react";

/**
 * Heading — semantic title elements (h1, h2, h3).
 *
 * Never use raw <h1>/<h2>/<h3> outside of components/ui/.
 * Every heading supports an optional leading icon.
 */
const meta: Meta<typeof Heading> = {
  title: "UI/Typography/Heading",
  component: Heading,
  tags: ["autodocs"],
  argTypes: {
    level: {
      control: "select",
      options: ["h1", "h2", "h3"],
    },
  },
};

export default meta;
type Story = StoryObj<typeof Heading>;

export const Primary: Story = {
  args: { level: "h1", children: "Dashboard" },
};

export const AllVariants: Story = {
  name: "All Variants",
  parameters: { controls: { disable: true } },
  render: () => (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--ao-spacing-4)", padding: "var(--ao-spacing-4)" }}>
      <Heading level="h1">Dashboard</Heading>
      <Heading level="h2">System Health</Heading>
      <Heading level="h3">Device Status</Heading>
      <Heading level="h2" icon={<IconUsers size={20} />}>Employees</Heading>
      <Heading level="h3" icon={<IconChartBar size={20} />}>Attendance Report</Heading>
    </div>
  ),
};

export const ContextPageHeader: Story = {
  name: "Context: Page Header",
  parameters: { controls: { disable: true } },
  render: () => (
    <div style={{ padding: "var(--ao-spacing-4)" }}>
      <Heading level="h1" icon={<IconDeviceDesktop size={24} />}>Devices</Heading>
      <p style={{ color: "var(--ao-font-color-secondary)", marginTop: 4 }}>
        Manage ZKTeco biometric scanners and attendance terminals.
      </p>
    </div>
  ),
};

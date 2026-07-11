import type { Meta, StoryObj } from "@storybook/react";
import { Callout } from "./callout";

const meta: Meta<typeof Callout> = {
  title: "UI/Feedback/Callout",
  component: Callout,
  tags: ["autodocs"],
  argTypes: {
    variant: { control: "select", options: ["info", "warning", "error", "success", "neutral"] },
    closable: { control: "boolean" },
  },
};

export default meta;
type Story = StoryObj<typeof Callout>;

export const Primary: Story = {
  args: {
    variant: "info",
    title: "Syncing Attendance Data",
    description: "New records are being pulled from connected devices. This may take a moment.",
  },
};

export const AllVariants: Story = {
  name: "All Variants",
  parameters: { controls: { disable: true } },
  render: () => (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--ao-spacing-4)", padding: "var(--ao-spacing-4)", maxWidth: 500 }}>
      <Callout variant="info" title="Information" description="This is an informational message for the user." />
      <Callout variant="warning" title="Warning" description="3 anomalies detected in the current view. Review them before exporting." />
      <Callout variant="error" title="Error" description="All devices are currently offline. Attendance data may be stale." />
      <Callout variant="success" title="Success" description="Settings have been saved successfully." />
      <Callout variant="neutral" title="Tip" description="Click any employee name to see their full attendance history." />
      <Callout variant="warning" title="Closable" description="This callout can be dismissed." closable onClose={() => {}} />
    </div>
  ),
};

export const ContextAnomaliesFound: Story = {
  name: "Context: Anomalies Detected",
  parameters: { controls: { disable: true } },
  render: () => (
    <Callout
      variant="warning"
      title="3 Anomalies Detected"
      description="Omar Khalid has 2 duplicate check-ins and 1 orphaned check-out. Review these records before generating the monthly report."
      action={{ label: "Review Anomalies", onClick: () => {} }}
    />
  ),
};

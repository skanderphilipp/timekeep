import type { Meta, StoryObj } from "@storybook/react";
import { Info } from "./info";

const meta: Meta<typeof Info> = {
  title: "UI/Feedback/Info",
  component: Info,
  tags: ["autodocs", "level:primitive"],
  argTypes: {
    accent: { control: "select", options: ["default", "danger"] },
  },
};

export default meta;
type Story = StoryObj<typeof Info>;

export const Primary: Story = {
  args: { text: "Polling interval: how often the system checks for new attendance records." },
};

export const AllVariants: Story = {
  name: "All Variants",
  parameters: { controls: { disable: true } },
  render: () => (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "var(--ao-spacing-4)",
        padding: "var(--ao-spacing-4)",
      }}
    >
      <div style={{ alignItems: "center", display: "flex", gap: "var(--ao-spacing-2)" }}>
        <span>Default accent</span>
        <Info text="This is helpful contextual information for the user." />
      </div>
      <div style={{ alignItems: "center", display: "flex", gap: "var(--ao-spacing-2)" }}>
        <span>Danger accent</span>
        <Info text="Warning: changing this may affect attendance calculations." accent="danger" />
      </div>
    </div>
  ),
};

export const ContextPollInterval: Story = {
  name: "Context: Settings Help",
  parameters: { controls: { disable: true } },
  render: () => (
    <div style={{ maxWidth: 400, padding: "var(--ao-spacing-4)" }}>
      <div
        style={{
          alignItems: "center",
          display: "flex",
          gap: "var(--ao-spacing-2)",
          marginBottom: 4,
        }}
      >
        <span style={{ fontWeight: 600 }}>Poll Interval</span>
        <Info text="How often the system pulls new attendance records from connected devices. Lower values mean more real-time data but higher load on the devices." />
      </div>
      <input type="number" defaultValue={60} style={{ padding: 4, width: 80 }} />
      <span style={{ marginLeft: 4 }}>seconds</span>
    </div>
  ),
};

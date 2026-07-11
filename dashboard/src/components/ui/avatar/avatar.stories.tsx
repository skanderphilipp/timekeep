import type { Meta, StoryObj } from "@storybook/react";
import { Avatar } from "./avatar";

const meta: Meta<typeof Avatar> = {
  title: "UI/Data Display/Avatar",
  component: Avatar,
  tags: ["autodocs"],
  argTypes: {
    size: { control: "select", options: ["sm", "md", "lg"] },
  },
};

export default meta;
type Story = StoryObj<typeof Avatar>;

export const Primary: Story = {
  args: { name: "Ahmed Al-Sabah", size: "md" },
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
      <div style={{ display: "flex", gap: "var(--ao-spacing-2)", alignItems: "center" }}>
        <Avatar name="Ahmed Al-Sabah" size="sm" />
        <Avatar name="Ahmed Al-Sabah" size="md" />
        <Avatar name="Ahmed Al-Sabah" size="lg" />
        <span style={{ fontSize: 12, color: "var(--ao-font-color-tertiary)" }}>sm / md / lg</span>
      </div>
      <div style={{ display: "flex", gap: "var(--ao-spacing-2)", alignItems: "center" }}>
        <Avatar name="Ahmed Al-Sabah" />
        <Avatar name="Fatima Hassan" />
        <Avatar name="Omar Khalid" />
        <Avatar name="Layla Noor" />
      </div>
      <div style={{ display: "flex", gap: "var(--ao-spacing-2)", alignItems: "center" }}>
        <Avatar name="A" />
        <span style={{ fontSize: 12, color: "var(--ao-font-color-tertiary)" }}>
          Single character name
        </span>
      </div>
    </div>
  ),
};

export const ContextEmployeeList: Story = {
  name: "Context: Employee Avatars",
  parameters: { controls: { disable: true } },
  render: () => (
    <div
      style={{
        display: "flex",
        gap: "var(--ao-spacing-4)",
        alignItems: "center",
        padding: "var(--ao-spacing-4)",
      }}
    >
      <Avatar name="Ahmed Al-Sabah" size="md" />
      <div>
        <div style={{ fontWeight: 600 }}>Ahmed Al-Sabah</div>
        <div style={{ fontSize: 12, color: "var(--ao-font-color-tertiary)" }}>
          PIN 145 · Operations
        </div>
      </div>
    </div>
  ),
};

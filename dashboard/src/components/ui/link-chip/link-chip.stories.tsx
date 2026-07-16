import type { Meta, StoryObj } from "@storybook/react";
import { LinkChip } from "./link-chip";

const meta: Meta<typeof LinkChip> = {
  title: "UI/Navigation/LinkChip",
  component: LinkChip,
  tags: ["autodocs", "level:primitive"],
};

export default meta;
type Story = StoryObj<typeof LinkChip>;

export const Primary: Story = {
  args: { label: "Ahmed Al-Sabah", to: "/employees/145" },
};

export const AllVariants: Story = {
  name: "All Variants",
  parameters: { controls: { disable: true } },
  render: () => (
    <div
      style={{
        display: "flex",
        gap: "var(--ao-spacing-2)",
        flexWrap: "wrap",
        padding: "var(--ao-spacing-4)",
      }}
    >
      <LinkChip label="Ahmed Al-Sabah" to="/employees/145" />
      <LinkChip label="Main Gate" to="/devices/CQZ7232960836" />
      <LinkChip label="Fatima Hassan" to="/employees/146" />
    </div>
  ),
};

export const ContextEmployeeLinks: Story = {
  name: "Context: Employee References",
  parameters: { controls: { disable: true } },
  render: () => (
    <div
      style={{
        display: "flex",
        gap: "var(--ao-spacing-1)",
        flexWrap: "wrap",
        padding: "var(--ao-spacing-4)",
      }}
    >
      <LinkChip label="Ahmed Al-Sabah" to="/employees/145" />
      <LinkChip label="Omar Khalid" to="/employees/147" />
      <LinkChip label="Fatima Hassan" to="/employees/146" />
    </div>
  ),
};

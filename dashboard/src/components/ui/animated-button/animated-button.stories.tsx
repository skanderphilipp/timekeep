import type { Meta, StoryObj } from "@storybook/react";
import { AnimatedButton } from "./animated-button";

const meta: Meta<typeof AnimatedButton> = {
  title: "UI/Actions/AnimatedButton",
  component: AnimatedButton,
  tags: ["autodocs"],
  argTypes: {
    variant: { control: "select", options: ["primary", "secondary", "ghost", "danger"] },
    size: { control: "select", options: ["sm", "md"] },
  },
};

export default meta;
type Story = StoryObj<typeof AnimatedButton>;

export const Primary: Story = {
  args: { children: "Get Started", variant: "primary" },
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
      <AnimatedButton variant="primary">Primary</AnimatedButton>
      <AnimatedButton variant="secondary">Secondary</AnimatedButton>
      <AnimatedButton variant="ghost">Ghost</AnimatedButton>
      <AnimatedButton variant="primary" disabled>
        Disabled
      </AnimatedButton>
      <AnimatedButton variant="primary" loading>
        Loading
      </AnimatedButton>
    </div>
  ),
};

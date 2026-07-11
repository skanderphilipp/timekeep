import type { Meta, StoryObj } from "@storybook/react";
import { Pill } from "./pill";
import { IconClock, IconSparkles } from "@tabler/icons-react";

const meta: Meta<typeof Pill> = {
  title: "UI/Data Display/Pill",
  component: Pill,
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof Pill>;

export const Primary: Story = {
  args: { label: "Soon" },
};

export const AllVariants: Story = {
  name: "All Variants",
  parameters: { controls: { disable: true } },
  render: () => (
    <div style={{ display: "flex", gap: "var(--ao-spacing-2)", flexWrap: "wrap", padding: "var(--ao-spacing-4)" }}>
      <Pill label="Soon" />
      <Pill label="Beta" Icon={IconSparkles} />
      <Pill label="New" />
      <Pill label="Coming Soon" Icon={IconClock} />
    </div>
  ),
};

export const ContextFeatureFlag: Story = {
  name: "Context: Feature Flag",
  parameters: { controls: { disable: true } },
  render: () => (
    <div style={{ display: "flex", alignItems: "center", gap: "var(--ao-spacing-2)", padding: "var(--ao-spacing-4)" }}>
      <span style={{ fontWeight: 600 }}>PDF Export</span>
      <Pill label="Soon" />
    </div>
  ),
};

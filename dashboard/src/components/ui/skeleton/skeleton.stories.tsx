import type { Meta, StoryObj } from "@storybook/react";
import { Skeleton, SkeletonLines } from "./skeleton";

/**
 * Skeleton — loading placeholder for async content.
 *
 * Renders animated placeholders that match the shape of the
 * content they replace (rect for cards, circle for avatars, text for lines).
 */
const meta: Meta<typeof Skeleton> = {
  title: "UI/Feedback/Skeleton",
  component: Skeleton,
  tags: ["autodocs"],
  argTypes: {
    variant: {
      control: "select",
      options: ["rect", "circle", "text"],
    },
  },
};

export default meta;
type Story = StoryObj<typeof Skeleton>;

export const Primary: Story = {
  args: { variant: "rect", width: "100%", height: 96 },
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
      <div>
        <Skeleton variant="rect" width="100%" height={96} />
      </div>
      <div style={{ display: "flex", gap: "var(--ao-spacing-2)", alignItems: "center" }}>
        <Skeleton variant="circle" width={48} height={48} />
        <div style={{ flex: 1 }}>
          <Skeleton variant="text" width="60%" height={20} />
          <Skeleton variant="text" width="40%" height={16} />
        </div>
      </div>
      <SkeletonLines lines={3} />
    </div>
  ),
};

export const ContextDashboardLoading: Story = {
  name: "Context: Dashboard Loading",
  parameters: { controls: { disable: true } },
  render: () => (
    <div
      style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "var(--ao-spacing-4)" }}
    >
      {[1, 2, 3, 4].map((i) => (
        <div
          key={i}
          style={{
            padding: "var(--ao-spacing-4)",
            background: "var(--ao-background-secondary)",
            borderRadius: "var(--ao-radius-md)",
          }}
        >
          <Skeleton variant="rect" width="100%" height={96} />
        </div>
      ))}
    </div>
  ),
};

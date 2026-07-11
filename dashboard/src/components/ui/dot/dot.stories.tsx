import type { Meta, StoryObj } from "@storybook/react";
import { Dot } from "./dot";

const meta: Meta<typeof Dot> = {
  title: "UI/Status/Dot",
  component: Dot,
  tags: ["autodocs"],
  argTypes: {
    size: { control: "select", options: ["sm", "md"] },
  },
};

export default meta;
type Story = StoryObj<typeof Dot>;

export const Primary: Story = {
  args: { color: "var(--ao-accent-accent9)", size: "sm" },
};

export const AllVariants: Story = {
  name: "All Variants",
  parameters: { controls: { disable: true } },
  render: () => (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--ao-spacing-4)", padding: "var(--ao-spacing-4)" }}>
      <div style={{ display: "flex", gap: "var(--ao-spacing-2)", alignItems: "center" }}>
        <Dot color="var(--ao-accent-accent9)" />
        <Dot color="var(--ao-accent-success9)" />
        <Dot color="var(--ao-accent-warning9)" />
        <Dot color="var(--ao-accent-danger9)" />
        <span style={{ fontSize: 12, color: "var(--ao-font-color-tertiary)" }}>sm (various colors)</span>
      </div>
      <div style={{ display: "flex", gap: "var(--ao-spacing-2)", alignItems: "center" }}>
        <Dot color="var(--ao-accent-accent9)" size="md" />
        <Dot color="var(--ao-accent-success9)" size="md" />
        <Dot color="var(--ao-accent-warning9)" size="md" />
        <Dot color="var(--ao-accent-danger9)" size="md" />
        <span style={{ fontSize: 12, color: "var(--ao-font-color-tertiary)" }}>md (various colors)</span>
      </div>
    </div>
  ),
};

export const ContextCalendarLegend: Story = {
  name: "Context: Calendar Legend",
  parameters: { controls: { disable: true } },
  render: () => (
    <div style={{ display: "flex", gap: "var(--ao-spacing-4)", alignItems: "center", padding: "var(--ao-spacing-4)" }}>
      <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
        <Dot color="var(--ao-accent-success9)" title="Present" />
        <span style={{ fontSize: 12 }}>Present</span>
      </div>
      <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
        <Dot color="var(--ao-accent-warning9)" title="Late" />
        <span style={{ fontSize: 12 }}>Late</span>
      </div>
      <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
        <Dot color="var(--ao-accent-danger9)" title="Absent" />
        <span style={{ fontSize: 12 }}>Absent</span>
      </div>
    </div>
  ),
};

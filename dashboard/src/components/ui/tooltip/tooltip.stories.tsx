import type { Meta, StoryObj } from "@storybook/react";
import { TooltipComponent } from "./tooltip";
import { Button } from "../button";

const meta: Meta<typeof TooltipComponent> = {
  title: "UI/Overlays/Tooltip",
  component: TooltipComponent,
  tags: ["autodocs"],
  argTypes: {
    side: { control: "select", options: ["top", "right", "bottom", "left"] },
  },
};

export default meta;
type Story = StoryObj<typeof TooltipComponent>;

export const Primary: Story = {
  render: () => (
    <div style={{ padding: "var(--ao-spacing-16)", display: "flex", justifyContent: "center" }}>
      <TooltipComponent content="Click to refresh attendance data">
        <Button variant="secondary">Refresh</Button>
      </TooltipComponent>
    </div>
  ),
};

export const AllVariants: Story = {
  name: "All Variants",
  parameters: { controls: { disable: true } },
  render: () => (
    <div
      style={{
        display: "flex",
        gap: "var(--ao-spacing-4)",
        padding: "var(--ao-spacing-16)",
        justifyContent: "center",
        flexWrap: "wrap",
      }}
    >
      <TooltipComponent content="Tooltip on top" side="top">
        <Button variant="secondary" size="sm">
          Top
        </Button>
      </TooltipComponent>
      <TooltipComponent content="Tooltip on bottom" side="bottom">
        <Button variant="secondary" size="sm">
          Bottom
        </Button>
      </TooltipComponent>
      <TooltipComponent content="Tooltip on left" side="left">
        <Button variant="secondary" size="sm">
          Left
        </Button>
      </TooltipComponent>
      <TooltipComponent content="Tooltip on right" side="right">
        <Button variant="secondary" size="sm">
          Right
        </Button>
      </TooltipComponent>
    </div>
  ),
};

export const ContextTruncatedText: Story = {
  name: "Context: Truncated Text",
  parameters: { controls: { disable: true } },
  render: () => (
    <div style={{ padding: "var(--ao-spacing-16)", display: "flex", justifyContent: "center" }}>
      <TooltipComponent content="CQZ7232960836 — SpeedFace-V5L [TI] · Firmware Ver 8.45">
        <span
          style={{
            maxWidth: 120,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            display: "inline-block",
          }}
        >
          CQZ7232960836 — SpeedFace-V5L...
        </span>
      </TooltipComponent>
    </div>
  ),
};

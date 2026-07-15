import type { Meta, StoryObj } from "@storybook/react";
import { OverflowingTextWithTooltip } from "./overflowing-text-with-tooltip";
import { Text } from "../text";

const meta: Meta<typeof OverflowingTextWithTooltip> = {
  title: "UI/Data Display/OverflowingTextWithTooltip",
  component: OverflowingTextWithTooltip,
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof OverflowingTextWithTooltip>;

export const Primary: Story = {
  render: () => (
    <div style={{ width: 150, padding: "var(--ao-spacing-8)" }}>
      <OverflowingTextWithTooltip text="CQZ7232960836 — SpeedFace-V5L [TI] · Firmware Ver 8.45" />
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
        flexDirection: "column",
        gap: "var(--ao-spacing-4)",
        padding: "var(--ao-spacing-4)",
      }}
    >
      <div style={{ width: 150 }}>
        <span
          style={{
            fontSize: 12,
            color: "var(--ao-font-color-tertiary)",
            display: "block",
            marginBottom: 4,
          }}
        >
          Single line — overflows
        </span>
        <OverflowingTextWithTooltip text="Main Gate — SpeedFace-V5L [TI] Serial Number CQZ7232960836" />
      </div>
      <div style={{ width: 150 }}>
        <span
          style={{
            fontSize: 12,
            color: "var(--ao-font-color-tertiary)",
            display: "block",
            marginBottom: 4,
          }}
        >
          Multi-line (max 2 rows)
        </span>
        <OverflowingTextWithTooltip
          text="Ahmed Al-Sabah checked in at Main Gate via facial recognition at 07:42 AM on Friday, July 11, 2026."
          displayedMaxRows={2}
        />
      </div>
    </div>
  ),
};

export const NoTooltipMode: Story = {
  name: "NoTooltip Mode (EllipsisDisplay replacement)",
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
      <div style={{ width: 300 }}>
        <Text variant="caption" color="tertiary" style={{ display: "block", marginBottom: 4 }}>
          300px container — fits
        </Text>
        <OverflowingTextWithTooltip noTooltip>
          Ahmed Al-Sabah · PIN 145 · Operations Department
        </OverflowingTextWithTooltip>
      </div>
      <div style={{ width: 150 }}>
        <Text variant="caption" color="tertiary" style={{ display: "block", marginBottom: 4 }}>
          150px container — truncates
        </Text>
        <OverflowingTextWithTooltip noTooltip>
          Ahmed Al-Sabah · PIN 145 · Operations Department
        </OverflowingTextWithTooltip>
      </div>
      <div style={{ width: 150 }}>
        <Text variant="caption" color="tertiary" style={{ display: "block", marginBottom: 4 }}>
          150px + maxWidth 100px
        </Text>
        <OverflowingTextWithTooltip noTooltip maxWidth={100}>
          Ahmed Al-Sabah · PIN 145 · Operations Department
        </OverflowingTextWithTooltip>
      </div>
    </div>
  ),
};

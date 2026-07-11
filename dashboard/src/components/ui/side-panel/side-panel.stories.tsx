import type { Meta, StoryObj } from "@storybook/react";
import { SidePanel } from "./side-panel";
import { Text } from "../text";
import { DetailGrid, DetailItem } from "../detail-grid";

const meta: Meta<typeof SidePanel> = {
  title: "UI/Overlays/SidePanel",
  component: SidePanel,
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof SidePanel>;

export const Primary: Story = {
  args: {
    open: true,
    title: "Omar Khalid — PIN 147",
    onClose: () => {},
    children: (
      <div style={{ padding: "var(--ao-spacing-4)" }}>
        <DetailGrid title="Employee Details">
          <DetailItem label="Department">Warehouse</DetailItem>
          <DetailItem label="Status">Active</DetailItem>
          <DetailItem label="Attendance">72% this month</DetailItem>
        </DetailGrid>
        <Text variant="caption" color="tertiary" style={{ marginTop: 16, display: "block" }}>
          Today's Punches: 3 anomalies detected.
        </Text>
      </div>
    ),
  },
};

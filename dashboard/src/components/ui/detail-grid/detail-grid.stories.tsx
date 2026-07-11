import type { Meta, StoryObj } from "@storybook/react";
import { DetailGrid, DetailItem } from "./detail-grid";
import { StatusBadge } from "../status-badge";
import { Text } from "../text";
import { Tag } from "../tag";

/**
 * DetailGrid — key-value display for entity detail views.
 *
 * Used in side panels (employee detail, device detail) and
 * profile/settings pages.
 */
const meta: Meta<typeof DetailGrid> = {
  title: "UI/Data Display/DetailGrid",
  component: DetailGrid,
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof DetailGrid>;

export const Primary: Story = {
  render: () => (
    <DetailGrid title="System Health">
      <DetailItem label="Status">
        <StatusBadge status="online" label="Healthy" />
      </DetailItem>
      <DetailItem label="Version">v1.2.3</DetailItem>
      <DetailItem label="Database">
        <StatusBadge status="online" label="Connected" />
      </DetailItem>
      <DetailItem label="Uptime">3d 14h 22m</DetailItem>
    </DetailGrid>
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
        gap: "var(--ao-spacing-6)",
        padding: "var(--ao-spacing-4)",
        maxWidth: 400,
      }}
    >
      <DetailGrid title="Account">
        <DetailItem label="Username">admin</DetailItem>
        <DetailItem label="Role">Administrator</DetailItem>
        <DetailItem label="Permissions">
          <Text variant="caption" color="tertiary">
            read:punches write:punches read:devices write:devices
          </Text>
        </DetailItem>
      </DetailGrid>
      <DetailGrid title="Device Information">
        <DetailItem label="Serial Number">CQZ7232960836</DetailItem>
        <DetailItem label="Model">SpeedFace-V5L [TI]</DetailItem>
        <DetailItem label="Firmware">Ver 8.45</DetailItem>
        <DetailItem label="Status">
          <StatusBadge status="online" label="Connected" />
        </DetailItem>
      </DetailGrid>
    </div>
  ),
};

export const ContextEmployeeDetail: Story = {
  name: "Context: Employee Detail",
  parameters: { controls: { disable: true } },
  render: () => (
    <DetailGrid title="Fatima Hassan — PIN 146">
      <DetailItem label="Department">Operations</DetailItem>
      <DetailItem label="External ID">EMP-042</DetailItem>
      <DetailItem label="Status">
        <Tag text="Active" color="green" />
      </DetailItem>
      <DetailItem label="Enrolled On">Main Gate, Warehouse B</DetailItem>
    </DetailGrid>
  ),
};

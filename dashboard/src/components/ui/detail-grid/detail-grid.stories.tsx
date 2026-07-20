import type { Meta, StoryObj } from "@storybook/react";

import { Badge } from "../badge";
import { Tag } from "../tag";
import { DetailGrid, DetailItem } from "./detail-grid";

/**
 * DetailGrid — horizontal label-value grid for entity detail views.
 *
 * Ported from RecordInlineCell layout: fixed-width label
 * column on the left, value column filling remaining space on the right.
 * String values automatically get overflow detection + tooltip.
 *
 * Used in side panels (employee detail, device detail) and
 * profile/settings pages.
 */
const meta: Meta<typeof DetailGrid> = {
  title: "UI/Data Display/DetailGrid",
  component: DetailGrid,
  tags: ["autodocs", "level:primitive"],
};

export default meta;
type Story = StoryObj<typeof DetailGrid>;

const Container = ({ children }: { children: React.ReactNode }) => (
  <div
    style={{
      background: "var(--ao-background-primary)",
      border: "1px solid var(--ao-border-color-light)",
      borderRadius: "var(--ao-radius-md)",
      maxWidth: 380,
      padding: "var(--ao-spacing-4)",
    }}
  >
    {children}
  </div>
);

export const Primary: Story = {
  render: () => (
    <Container>
      <DetailGrid title="System Health">
        <DetailItem label="Status">
          <Badge dot="online" variant="success">
            Healthy
          </Badge>
        </DetailItem>
        <DetailItem label="Version">v1.2.3</DetailItem>
        <DetailItem label="Database">
          <Badge dot="online" variant="success">
            Connected
          </Badge>
        </DetailItem>
        <DetailItem label="Uptime">3d 14h 22m</DetailItem>
      </DetailGrid>
    </Container>
  ),
};

export const AccountInfo: Story = {
  name: "Account Info",
  render: () => (
    <Container>
      <DetailGrid title="Account">
        <DetailItem label="Username">admin</DetailItem>
        <DetailItem label="Role">Administrator</DetailItem>
        <DetailItem label="Status">
          <Tag text="Active" color="green" />
        </DetailItem>
        <DetailItem label="Permissions">read:punches write:punches read:devices</DetailItem>
      </DetailGrid>
    </Container>
  ),
};

export const DeviceInformation: Story = {
  name: "Device Information",
  render: () => (
    <Container>
      <DetailGrid title="Device Information">
        <DetailItem label="Serial No.">CQZ7232960836</DetailItem>
        <DetailItem label="Model">SpeedFace-V5L [TI]</DetailItem>
        <DetailItem label="Firmware">Ver 8.45</DetailItem>
        <DetailItem label="Connection">
          <Badge dot="online" variant="success">
            Connected
          </Badge>
        </DetailItem>
      </DetailGrid>
    </Container>
  ),
};

export const EmployeeDetail: Story = {
  name: "Context: Employee Detail",
  render: () => (
    <Container>
      <DetailGrid title="Fatima Hassan — PIN 146">
        <DetailItem label="Department">Operations</DetailItem>
        <DetailItem label="External ID">EMP-042</DetailItem>
        <DetailItem label="Status">
          <Tag text="Active" color="green" />
        </DetailItem>
        <DetailItem label="Enrolled On">Main Gate, Warehouse B</DetailItem>
      </DetailGrid>
    </Container>
  ),
};

export const WithLongText: Story = {
  name: "Overflow Behavior",
  render: () => (
    <Container>
      <DetailGrid title="Overflow Handling">
        <DetailItem label="Short">Visible text</DetailItem>
        <DetailItem label="Long Value">
          This is a very long text value that should overflow the container and show a tooltip on
          hover
        </DetailItem>
        <DetailItem label="Long Label">
          <Badge variant="success">Short</Badge>
        </DetailItem>
      </DetailGrid>
    </Container>
  ),
};

export const AllContexts: Story = {
  name: "All Contexts",
  parameters: { controls: { disable: true } },
  render: () => (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "var(--ao-spacing-6)",
        maxWidth: 420,
        padding: "var(--ao-spacing-4)",
      }}
    >
      <div
        style={{
          background: "var(--ao-background-primary)",
          border: "1px solid var(--ao-border-color-light)",
          borderRadius: "var(--ao-radius-md)",
        }}
      >
        <DetailGrid title="Account">
          <DetailItem label="Username">admin</DetailItem>
          <DetailItem label="Role">Administrator</DetailItem>
          <DetailItem label="Status">
            <Tag text="Active" color="green" />
          </DetailItem>
        </DetailGrid>
      </div>

      <div
        style={{
          background: "var(--ao-background-primary)",
          border: "1px solid var(--ao-border-color-light)",
          borderRadius: "var(--ao-radius-md)",
        }}
      >
        <DetailGrid title="Device">
          <DetailItem label="Serial No.">CQZ7232960836</DetailItem>
          <DetailItem label="Model">SpeedFace-V5L [TI]</DetailItem>
          <DetailItem label="Status">
            <Badge dot="online" variant="success">
              Connected
            </Badge>
          </DetailItem>
        </DetailGrid>
      </div>
    </div>
  ),
};

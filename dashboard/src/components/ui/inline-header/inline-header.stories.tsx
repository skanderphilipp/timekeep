import type { Meta, StoryObj } from "@storybook/react";
import { InlineHeader } from "./inline-header";
import { Badge } from "../badge";
import { IconDeviceDesktop, IconUsers } from "@tabler/icons-react";

const meta: Meta<typeof InlineHeader> = {
  title: "UI/Separators/InlineHeader",
  component: InlineHeader,
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof InlineHeader>;

export const Primary: Story = {
  render: () => (
    <InlineHeader icon={<IconDeviceDesktop size={20} />} title="Main Gate">
      <Badge variant="success">Online</Badge>
    </InlineHeader>
  ),
};

export const AllVariants: Story = {
  name: "All Variants",
  parameters: { controls: { disable: true } },
  render: () => (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--ao-spacing-4)", padding: "var(--ao-spacing-4)" }}>
      <InlineHeader icon={<IconDeviceDesktop size={20} />} title="Main Gate">
        <Badge variant="success">Online</Badge>
      </InlineHeader>
      <InlineHeader icon={<IconDeviceDesktop size={20} />} title="Office Floor">
        <Badge variant="danger">Offline</Badge>
      </InlineHeader>
      <InlineHeader icon={<IconUsers size={20} />} title="Currently Checked In">
        <Badge variant="success">42</Badge>
      </InlineHeader>
    </div>
  ),
};

export const ContextDeviceCard: Story = {
  name: "Context: Device Card Header",
  parameters: { controls: { disable: true } },
  render: () => (
    <div style={{ padding: "var(--ao-spacing-4)", border: "1px solid var(--ao-border-secondary)", borderRadius: "var(--ao-radius-md)" }}>
      <InlineHeader icon={<IconDeviceDesktop size={20} />} title="Main Gate">
        <Badge variant="success">Connected</Badge>
      </InlineHeader>
      <div style={{ marginTop: 8, fontSize: 14, color: "var(--ao-font-color-secondary)" }}>
        SN: CQZ7232960836 · Model: SpeedFace-V5L [TI]
      </div>
    </div>
  ),
};

import type { Meta, StoryObj } from "@storybook/react";
import { MetadataGrid, type MetadataField } from "./metadata-grid";
import { Card, Badge } from "@/components/ui";
import { IconServer, IconCpu, IconDeviceDesktop } from "@tabler/icons-react";

/**
 * MetadataGrid — schema-driven key-value display grid.
 *
 * Takes an array of `MetadataField` descriptors and renders them
 * using `DetailGrid` + `DetailItem`. Fields with `hideIf: true` are
 * automatically skipped.
 */
const meta: Meta<typeof MetadataGrid> = {
  title: "UI/Data Display/MetadataGrid",
  component: MetadataGrid,
  tags: ["autodocs", "level:primitive"],
};

export default meta;
type Story = StoryObj<typeof MetadataGrid>;

// ── Mock field schemas ──────────────────────────────────────────────────

const DEVICE_IDENTITY: MetadataField[] = [
  { key: "sn", label: "Serial Number", value: "CQZ7232960836" },
  { key: "label", label: "Label", value: "Office Entrance" },
  { key: "host", label: "Host", value: "192.168.1.100" },
  { key: "port", label: "Port", value: "4370" },
  { key: "push", label: "Push Enabled", value: "Yes" },
];

const DEVICE_HARDWARE: MetadataField[] = [
  { key: "model", label: "Model", value: "SpeedFace-V5L", icon: <IconDeviceDesktop size={16} /> },
  { key: "fw", label: "Firmware", value: "Ver 8.0.2.6-20240315", icon: <IconCpu size={16} /> },
  { key: "platform", label: "Platform", value: "ZAM170", icon: <IconServer size={16} /> },
  { key: "mac", label: "MAC Address", value: "00:17:61:AB:CD:EF" },
];

const DEVICE_CAPACITY: MetadataField[] = [
  { key: "users", label: "Users", value: "47 / 3,000 (1.6%)" },
  { key: "records", label: "Records", value: "12,500 / 100,000 (12.5%)" },
  {
    key: "fingerprints",
    label: "Fingerprints",
    value: "85 / 3,000 (2.8%)",
    hideIf: false,
  },
  { key: "faces", label: "Faces", value: "47 / 3,000 (1.6%)", hideIf: false },
];

const DEVICE_WITH_HIDDEN: MetadataField[] = [
  { key: "sn", label: "Serial Number", value: "BIO8865123472" },
  { key: "model", label: "Model", value: "MA300" },
  { key: "fw", label: "Firmware", value: "Ver 3.4.1" },
  { key: "platform", label: "Platform", value: undefined, hideIf: true },
  { key: "mac", label: "MAC Address", value: null, hideIf: true },
];

// ── Stories ──────────────────────────────────────────────────────────────

export const BasicFields: Story = {
  args: {
    fields: DEVICE_IDENTITY,
  },
};

export const WithIcons: Story = {
  args: {
    fields: DEVICE_HARDWARE,
  },
};

export const WithTitle: Story = {
  args: {
    fields: DEVICE_CAPACITY,
    title: "Capacity",
  },
};

export const HiddenFields: Story = {
  args: {
    fields: DEVICE_WITH_HIDDEN,
  },
};

export const AllSections: Story = {
  name: "All Sections (Device Detail)",
  parameters: { controls: { disable: true } },
  render: () => (
    <Card>
      <Card.Content>
        <MetadataGrid title="Identity" fields={DEVICE_IDENTITY} />
        <MetadataGrid title="Hardware" fields={DEVICE_HARDWARE} />
        <MetadataGrid title="Capacity" fields={DEVICE_CAPACITY} />
      </Card.Content>
    </Card>
  ),
};

export const WithBadgeValues: Story = {
  name: "With Badge Values",
  parameters: { controls: { disable: true } },
  render: () => (
    <Card>
      <Card.Content>
        <MetadataGrid
          title="Connection"
          fields={[
            { key: "sdk", label: "SDK Poll", value: <Badge variant="success" size="sm">Active</Badge> },
            { key: "adms", label: "ADMS Active", value: <Badge variant="warning" size="sm">Inactive</Badge> },
            { key: "status", label: "Connection", value: <Badge variant="success" dot="online" size="sm">Online</Badge> },
          ]}
        />
      </Card.Content>
    </Card>
  ),
};

export const EmptySchema: Story = {
  args: {
    fields: [],
  },
};

export const AllHidden: Story = {
  args: {
    fields: [
      { key: "a", label: "Hidden A", value: "x", hideIf: true },
      { key: "b", label: "Hidden B", value: "y", hideIf: true },
    ],
  },
};

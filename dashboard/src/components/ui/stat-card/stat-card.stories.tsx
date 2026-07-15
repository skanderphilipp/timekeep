import type { Meta, StoryObj } from "@storybook/react";
import { StatCard } from "./stat-card";
import {
  IconUsers,
  IconDatabase,
  IconCpu,
  IconServer,
  IconUserX,
  IconClockExclamation,
  IconClockCheck,
  IconCalendarStats,
} from "@tabler/icons-react";

/**
 * StatCard — unified metric/stat card with two layout variants.
 *
 * - **Vertical** — icon on top, prominent value, label below, optional
 *   capacity progress bar. Successor to DeviceHealthCard.
 * - **Horizontal** — icon + label/value side by side in a Card wrapper,
 *   with color-coded icon accent. Successor to MetricCard.
 */
const meta: Meta<typeof StatCard> = {
  title: "UI/Data Display/StatCard",
  component: StatCard,
  tags: ["autodocs"],
  argTypes: {
    layout: {
      control: "radio",
      options: ["vertical", "horizontal"],
    },
    color: {
      control: "select",
      options: ["green", "red", "amber", "accent", "neutral"],
    },
  },
};

export default meta;
type Story = StoryObj<typeof StatCard>;

// ── Vertical (DeviceHealthCard style) ───────────────────────────────────

export const VerticalBasic: Story = {
  args: {
    icon: <IconUsers size={20} />,
    label: "Users",
    value: "47 / 3,000",
    subtitle: "1.6% used",
    layout: "vertical",
    capacity: { current: 47, max: 3000 },
  },
};

export const VerticalNoCapacity: Story = {
  args: {
    icon: <IconCpu size={20} />,
    label: "Firmware",
    value: "Ver 8.0.2.6",
    layout: "vertical",
  },
};

export const VerticalStorageWarning: Story = {
  args: {
    icon: <IconServer size={20} />,
    label: "Storage",
    value: "65%",
    subtitle: "65,000 / 100,000",
    layout: "vertical",
    capacity: { current: 65000, max: 100000 },
  },
};

export const VerticalStorageDanger: Story = {
  args: {
    icon: <IconServer size={20} />,
    label: "Storage",
    value: "92%",
    subtitle: "92,000 / 100,000 — Critical",
    layout: "vertical",
    capacity: { current: 92000, max: 100000 },
  },
};

// ── Horizontal (MetricCard style) ───────────────────────────────────────

export const HorizontalGreen: Story = {
  args: {
    icon: <IconUsers size={24} />,
    label: "Present",
    value: 42,
    subtitle: "of 50",
    layout: "horizontal",
    color: "green",
  },
};

export const HorizontalRed: Story = {
  args: {
    icon: <IconUserX size={24} />,
    label: "Absent",
    value: 8,
    subtitle: "of 50",
    layout: "horizontal",
    color: "red",
  },
};

export const HorizontalAmber: Story = {
  args: {
    icon: <IconClockExclamation size={24} />,
    label: "Late",
    value: 3,
    subtitle: "today",
    layout: "horizontal",
    color: "amber",
  },
};

export const HorizontalAccent: Story = {
  args: {
    icon: <IconCalendarStats size={24} />,
    label: "Work Days",
    value: 22,
    subtitle: "this month",
    layout: "horizontal",
    color: "accent",
  },
};

// ── All Variants overview ───────────────────────────────────────────────

export const AllVertical: Story = {
  name: "All Variants: Vertical",
  parameters: { controls: { disable: true } },
  render: () => (
    <div style={{ display: "flex", gap: 12, flexWrap: "wrap", padding: 16 }}>
      <StatCard
        icon={<IconUsers size={20} />}
        label="Users"
        value="47 / 3,000"
        subtitle="1.6% used"
        capacity={{ current: 47, max: 3000 }}
      />
      <StatCard
        icon={<IconDatabase size={20} />}
        label="Records"
        value="12,500"
      />
      <StatCard
        icon={<IconCpu size={20} />}
        label="Firmware"
        value="Ver 8.0.2.6"
      />
      <StatCard
        icon={<IconServer size={20} />}
        label="Storage"
        value="65%"
        subtitle="65,000 / 100,000"
        capacity={{ current: 65000, max: 100000 }}
      />
    </div>
  ),
};

export const AllHorizontal: Story = {
  name: "All Variants: Horizontal",
  parameters: { controls: { disable: true } },
  render: () => (
    <div style={{ display: "flex", gap: 12, flexWrap: "wrap", padding: 16 }}>
      <StatCard
        icon={<IconUsers size={24} />}
        label="Present"
        value={42}
        subtitle="of 50"
        layout="horizontal"
        color="green"
      />
      <StatCard
        icon={<IconUserX size={24} />}
        label="Absent"
        value={8}
        subtitle="of 50"
        layout="horizontal"
        color="red"
      />
      <StatCard
        icon={<IconClockExclamation size={24} />}
        label="Late"
        value={3}
        subtitle="today"
        layout="horizontal"
        color="amber"
      />
      <StatCard
        icon={<IconClockCheck size={24} />}
        label="On Time"
        value={39}
        subtitle="today"
        layout="horizontal"
        color="green"
      />
    </div>
  ),
};

export const ContextDashboard: Story = {
  name: "Context: Dashboard KPIs",
  parameters: { controls: { disable: true } },
  render: () => (
    <div style={{ display: "flex", gap: 12, flexWrap: "wrap", padding: 16 }}>
      <StatCard icon={<IconUsers size={24} />} label="Present" value={42} subtitle="of 50" layout="horizontal" color="green" />
      <StatCard icon={<IconUserX size={24} />} label="Absent" value={8} subtitle="of 50" layout="horizontal" color="red" />
      <StatCard icon={<IconClockExclamation size={24} />} label="Late" value={3} subtitle="today" layout="horizontal" color="amber" />
      <StatCard icon={<IconClockCheck size={24} />} label="On Time" value={39} subtitle="today" layout="horizontal" color="green" />
    </div>
  ),
};

export const ContextDeviceHealth: Story = {
  name: "Context: Device Health",
  parameters: { controls: { disable: true } },
  render: () => (
    <div style={{ display: "flex", gap: 12, flexWrap: "wrap", padding: 16 }}>
      <StatCard icon={<IconUsers size={20} />} label="Users" value="47 / 3,000" subtitle="1.6% used" capacity={{ current: 47, max: 3000 }} />
      <StatCard icon={<IconDatabase size={20} />} label="Records" value="12,500" />
      <StatCard icon={<IconCpu size={20} />} label="Firmware" value="Ver 8.0.2.6" />
      <StatCard icon={<IconServer size={20} />} label="Storage" value="65%" subtitle="65,000 / 100,000" capacity={{ current: 65000, max: 100000 }} />
    </div>
  ),
};

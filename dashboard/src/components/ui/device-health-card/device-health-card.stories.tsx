import type { Meta, StoryObj } from "@storybook/react";
import { DeviceHealthCard } from "./device-health-card";
import { IconDeviceDesktop } from "@tabler/icons-react";

const meta: Meta<typeof DeviceHealthCard> = {
  title: "UI/Status/DeviceHealthCard",
  component: DeviceHealthCard,
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof DeviceHealthCard>;

export const Primary: Story = {
  args: {
    icon: <IconDeviceDesktop size={20} />,
    value: "45,230",
    label: "Records",
    subtitle: "75.4% used",
    capacity: { current: 45230, max: 60000 },
  },
};

export const AllVariants: Story = {
  name: "All Variants",
  parameters: { controls: { disable: true } },
  render: () => (
    <div
      style={{
        display: "flex",
        gap: "var(--ao-spacing-4)",
        flexWrap: "wrap",
        padding: "var(--ao-spacing-4)",
      }}
    >
      <DeviceHealthCard
        icon={<IconDeviceDesktop size={20} />}
        value="12,000"
        label="Records"
        capacity={{ current: 12000, max: 100000 }}
        subtitle="12% used"
      />
      <DeviceHealthCard
        icon={<IconDeviceDesktop size={20} />}
        value="65,000"
        label="Records"
        capacity={{ current: 65000, max: 100000 }}
        subtitle="65% used"
      />
      <DeviceHealthCard
        icon={<IconDeviceDesktop size={20} />}
        value="92,000"
        label="Records"
        capacity={{ current: 92000, max: 100000 }}
        subtitle="92% used — Critical"
      />
    </div>
  ),
};

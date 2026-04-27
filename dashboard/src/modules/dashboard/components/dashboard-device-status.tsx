import { useLingui } from "@lingui/react";
import { msg } from "@lingui/core/macro";
import { IconDeviceDesktop } from "@tabler/icons-react";

import { Heading, Text, Badge, CardGrid, Card } from "@/components/ui";
import { Banner } from "@/components/ui/banner";
import type { DashboardDeviceHealth } from "@/lib/api";

type DashboardDeviceStatusProps = {
  devices: DashboardDeviceHealth[];
  onDeviceClick: (sn: string, label: string) => void;
};

export function DashboardDeviceStatus({ devices, onDeviceClick }: DashboardDeviceStatusProps) {
  const { _ } = useLingui();

  return (
    <>
      <Heading level="h3" icon={<IconDeviceDesktop size={20} />}>
        {_(msg`Device Status`)}
      </Heading>
      <CardGrid>
        {devices.map((device) => (
          <Card
            key={device.serial_number}
            data-slot="device-status-card"
            onClick={() => onDeviceClick(device.serial_number, device.label)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onDeviceClick(device.serial_number, device.label);
              }
            }}
            tabIndex={0}
            role="button"
            style={{ cursor: "pointer" }}
          >
            <Card.Content>
              <Badge variant={device.online ? "success" : "danger"}>
                {device.online ? _(msg`Online`) : _(msg`Offline`)}
              </Badge>
              <Text variant="body" weight="medium">
                {device.label}
              </Text>
              <Text variant="caption" color="tertiary">
                SN: {device.serial_number}
              </Text>
            </Card.Content>
          </Card>
        ))}
      </CardGrid>
      {devices.every((d) => !d.online) && (
        <Banner variant="danger">
          {_(msg`All devices are currently offline. Attendance data may be stale.`)}
        </Banner>
      )}
    </>
  );
}

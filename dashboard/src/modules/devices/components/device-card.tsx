import type { DeviceSummary } from "@/lib/api";
import { Link } from "react-router-dom";
import { useLingui } from "@lingui/react";
import { msg } from "@lingui/core/macro";

import { AppRoute } from "@/lib/navigation";
import { getDeviceStatusUI } from "@/lib/device-status-ui";
import { getDeviceStatus } from "@shared/device-statuses";
import { Card, Badge, StatusDot, InlineHeader, Text } from "@/components/ui";

type DeviceCardProps = {
  device: DeviceSummary;
};

export function DeviceCard({ device }: DeviceCardProps) {
  const { _ } = useLingui();
  const statusUI = getDeviceStatusUI(device.connection_status);
  const statusDef = getDeviceStatus(device.connection_status);

  return (
    <Link to={AppRoute.devices.detail(device.serial_number)}>
      <Card>
        <Card.Content>
          <InlineHeader
            icon={
              <StatusDot
                status={statusUI.dotColor}
                pulsing={device.connection_status === "online"}
              />
            }
            title={device.label}
          >
            <Badge variant={statusUI.variant} dot={statusUI.dotColor}>
              {statusDef?.label ?? _(msg`Unknown`)}
            </Badge>
            {device.auto_registered && (
              <Badge variant="info" size="sm">
                {_(msg`Auto`)}
              </Badge>
            )}
          </InlineHeader>
          <Text variant="caption" color="tertiary">
            {device.serial_number}
          </Text>
          <Text variant="caption" color="tertiary">
            {device.host}:{device.port}
          </Text>
        </Card.Content>
      </Card>
    </Link>
  );
}

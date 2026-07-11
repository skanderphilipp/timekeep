import type { DeviceSummary } from "@/lib/api";
import { Link } from "react-router-dom";
import { useLingui } from "@lingui/react";
import { msg } from "@lingui/core/macro";
import { Card, Badge, StatusDot, InlineHeader, Text } from "@/components/ui";

type DeviceCardProps = {
  device: DeviceSummary;
};

export function DeviceCard({ device }: DeviceCardProps) {
  const { _ } = useLingui();

  return (
    <Link to={`/devices/${device.serial_number}/edit`}>
      <Card>
        <Card.Content>
          <InlineHeader
            icon={
              <StatusDot
                status={device.push_enabled ? "online" : "offline"}
                pulsing={device.push_enabled}
              />
            }
            title={device.label}
          >
            <Badge variant={device.push_enabled ? "success" : "neutral"}>
              {device.push_enabled ? _(msg`Active`) : _(msg`Inactive`)}
            </Badge>
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

import { useLingui } from "@lingui/react";
import { msg } from "@lingui/core/macro";

import { Heading, Text, Separator, DetailGrid, DetailItem } from "@/components/ui";

type DeviceDetailPanelProps = {
  serialNumber: string;
  deviceName: string;
};

export function DeviceDetailPanel({ serialNumber, deviceName }: DeviceDetailPanelProps) {
  const { _ } = useLingui();

  return (
    <>
      <Heading level="h3">{deviceName}</Heading>
      <Separator />
      <DetailGrid>
        <DetailItem label={_(msg`Serial Number`)}>
          <Text variant="body">{serialNumber}</Text>
        </DetailItem>
        <DetailItem label={_(msg`Status`)}>
          <Text variant="body" color="secondary">
            {_(msg`Device details will be available when connected to the timekeep server.`)}
          </Text>
        </DetailItem>
      </DetailGrid>
    </>
  );
}

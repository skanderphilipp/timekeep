import { useLingui } from "@lingui/react";
import { msg } from "@lingui/core/macro";

import { Heading } from "@/components/ui/heading";
import { Text } from "@/components/ui/text";
import { Separator } from "@/components/ui/separator";
import { StatusDot } from "@/components/ui/status-dot";
import { useEntityDetail } from "../hooks/use-entity-detail";

type DeviceDetailViewProps = {
  serialNumber: string;
};

/**
 * Device detail view — rendered inside the SidePanel when a device
 * serial number is clicked.
 *
 * Displays live device identity, status, and configuration.
 */
export function DeviceDetailView({ serialNumber }: DeviceDetailViewProps) {
  const { data: device, isLoading, error } = useEntityDetail("device", serialNumber);
  const { _ } = useLingui();

  if (isLoading) {
    return (
      <div style={{ padding: "24px" }}>
        <Text variant="body" color="tertiary">
          {_(msg`Loading device ${serialNumber}`)}…
        </Text>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: "24px" }}>
        <Text variant="body" color="danger">
          {_(msg`Failed to load device details.`)}
        </Text>
      </div>
    );
  }

  return (
    <div style={{ padding: "0" }}>
      <div style={{ padding: "16px 24px" }}>
        <Heading level="h3" color="primary">
          {serialNumber}
        </Heading>
      </div>

      <Separator />

      <dl style={{ padding: "16px 24px", margin: 0 }}>
        <dt
          style={{
            fontSize: "12px",
            fontWeight: 500,
            color: "var(--color-text-tertiary)",
            marginBottom: "4px",
          }}
        >
          {_(msg`Serial Number`)}
        </dt>
        <dd style={{ margin: "0 0 16px 0", fontFamily: "monospace" }}>
          {serialNumber}
        </dd>

        <dt
          style={{
            fontSize: "12px",
            fontWeight: 500,
            color: "var(--color-text-tertiary)",
            marginBottom: "4px",
          }}
        >
          {_(msg`Status`)}
        </dt>
        <dd style={{ margin: "0 0 16px 0", display: "flex", alignItems: "center", gap: "8px" }}>
          <StatusDot status="offline" />
          <Text variant="body" color="secondary">
            {device
              ? _(msg`Connected`)
              : _(msg`Device details will be available when connected to the timekeep server.`)}
          </Text>
        </dd>
      </dl>
    </div>
  );
}

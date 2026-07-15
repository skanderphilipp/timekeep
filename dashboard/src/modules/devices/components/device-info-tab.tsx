import { useLingui } from "@lingui/react";
import { msg } from "@lingui/core/macro";

import { MetadataGrid, Badge } from "@/components/ui";
import type { MetadataField } from "@/components/ui";
import type { DeviceDetailResponse, DeviceHealthInfo } from "@/lib/api";

type DeviceInfoTabProps = {
  device: DeviceDetailResponse;
  deviceHealth?: DeviceHealthInfo | null;
};

/**
 * Derive the metadata field schema from the device API response.
 *
 * Each field is rendered as a key-value pair in {@link MetadataGrid}.
 * Fields with `hideIf: true` are automatically skipped — no conditional
 * JSX logic in the render path.
 */
function deviceInfoFields(
  device: DeviceDetailResponse,
  deviceHealth: DeviceHealthInfo | null | undefined,
  _: ReturnType<typeof useLingui>["_"],
): MetadataField[] {
  return [
    // ── Identity ──
    { key: "sn", label: _(msg`Serial Number`), value: device.serial_number },
    { key: "label", label: _(msg`Label`), value: device.label || "—" },
    { key: "host", label: _(msg`Host`), value: device.host },
    { key: "port", label: _(msg`Port`), value: String(device.port) },
    {
      key: "push",
      label: _(msg`Push Enabled`),
      value: device.push_enabled ? _(msg`Yes`) : _(msg`No`),
    },

    // ── Hardware (conditional) ──
    {
      key: "model",
      label: _(msg`Model`),
      value: device.model ?? "—",
      hideIf: !device.model,
    },
    {
      key: "fw",
      label: _(msg`Firmware`),
      value: device.firmware_version ?? "—",
      hideIf: !device.firmware_version,
    },
    {
      key: "platform",
      label: _(msg`Platform`),
      value: device.platform ?? "—",
      hideIf: !device.platform,
    },
    {
      key: "mac",
      label: _(msg`MAC Address`),
      value: device.mac_address ?? "—",
      hideIf: !device.mac_address,
    },

    // ── Connection ──
    {
      key: "adms",
      label: _(msg`ADMS Active`),
      value: device.adms_active ? (
        <Badge variant="success" size="sm">{_(msg`Yes`)}</Badge>
      ) : (
        <Badge variant="neutral" size="sm">{_(msg`No`)}</Badge>
      ),
    },
    {
      key: "sdk",
      label: _(msg`SDK Poll`),
      value: device.sdk_poll_active ? (
        <Badge variant="success" size="sm">{_(msg`Active`)}</Badge>
      ) : (
        <Badge variant="neutral" size="sm">{_(msg`Inactive`)}</Badge>
      ),
    },

    // ── Capacity (conditional) ──
    {
      key: "fingerprints",
      label: _(msg`Fingerprints`),
      value: `${device.fingerprint_count} / ${device.fingerprint_capacity}`,
      hideIf: device.fingerprint_capacity <= 0,
    },
    {
      key: "faces",
      label: _(msg`Faces`),
      value: `${device.face_count} / ${device.face_capacity}`,
      hideIf: device.face_capacity <= 0,
    },

    // ── Sync (conditional) ──
    {
      key: "last_sync",
      label: _(msg`Last Sync`),
      value: device.last_sync_at != null
        ? new Date(device.last_sync_at * 1000).toLocaleString()
        : "—",
      hideIf: device.last_sync_at == null,
    },
    {
      key: "last_seen",
      label: _(msg`Last Seen`),
      value: deviceHealth?.last_seen_secs_ago != null
        ? `${deviceHealth.last_seen_secs_ago}s ago`
        : "—",
      hideIf: deviceHealth?.last_seen_secs_ago == null,
    },
  ];
}

/**
 * Device info tab — metadata grid with identity, hardware, connection,
 * capacity, and sync status fields.
 *
 * All field definitions live in {@link deviceInfoFields} which returns
 * a schema array. {@link MetadataGrid} handles rendering, hiding
 * conditional fields via `hideIf`. No conditional JSX in the render path.
 */
export function DeviceInfoTab({ device, deviceHealth }: DeviceInfoTabProps) {
  const { _ } = useLingui();
  const fields = deviceInfoFields(device, deviceHealth, _);

  return <MetadataGrid fields={fields} />;
}

import { useLingui } from "@lingui/react";
import { msg } from "@lingui/core/macro";
import { IconTrash } from "@tabler/icons-react";

import { Button, Text, EmptyState } from "@/components/ui";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { QueryKeys } from "@/lib/query-keys";
import { fetchDevicesInGroup, setDeviceGroup, type DeviceGroup } from "@/lib/api";
import type { DeviceSummary } from "@/lib/api";
import { useToast } from "@/infrastructure/toast/toast";

/**
 * Devices tab content for a device group detail page.
 *
 * Lists all devices in this group with the ability to remove them.
 * Adding devices is done via the device edit form (group_id selector).
 *
 * Injected via `tabChildren.devices` on the `RecordDetailRenderer`.
 */
export function DeviceGroupDevicesTab({ group }: { group: DeviceGroup }) {
  const { _ } = useLingui();
  const toast = useToast();
  const queryClient = useQueryClient();

  const {
    data: devices = [],
    isLoading,
  } = useQuery<DeviceSummary[]>({
    queryKey: QueryKeys.deviceGroups.devices(group.id),
    queryFn: () => fetchDevicesInGroup(group.id),
  });

  const removeDevice = useMutation({
    mutationFn: (sn: string) => setDeviceGroup(sn, { group_id: null }),
    onSuccess: () => {
      toast.success(_(msg`Device removed from group.`));
      queryClient.invalidateQueries({ queryKey: QueryKeys.deviceGroups.all });
      queryClient.invalidateQueries({ queryKey: ["devices"] });
    },
    onError: () => {
      toast.error(_(msg`Failed to remove device.`));
    },
  });

  if (isLoading) {
    return <Text variant="body" color="secondary">{_(msg`Loading devices…`)}</Text>;
  }

  if (devices.length === 0) {
    return (
      <EmptyState
        title={_(msg`No devices in this group`)}
        description={_(msg`Assign devices to this group via the device edit form. Open any device and select this group in the Config tab.`)}
      />
    );
  }

  return (
    <div>
      <Text variant="body" color="secondary" style={{ marginBottom: 12 }}>
        {_(msg`{count, plural, one {# device} other {# devices}} in this group. Remove devices here or assign new ones via the device edit form.`).replace("{count, plural, one {# device} other {# devices}}", String(devices.length))}
      </Text>

      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th style={{ textAlign: "left", padding: 8 }}>{_(msg`Label`)}</th>
            <th style={{ textAlign: "left", padding: 8 }}>{_(msg`Host`)}</th>
            <th style={{ textAlign: "left", padding: 8 }}>{_(msg`Status`)}</th>
            <th style={{ padding: 8 }} />
          </tr>
        </thead>
        <tbody>
          {devices.map((device) => (
            <tr key={device.serial_number}>
              <td style={{ padding: 8 }}>
                <Text variant="body">{device.label}</Text>
              </td>
              <td style={{ padding: 8 }}>
                <Text variant="body" color="secondary">
                  {device.host}:{device.port}
                </Text>
              </td>
              <td style={{ padding: 8 }}>
                <Text variant="body" color={device.connection_status === "online" ? "success" : "tertiary"}>
                  {device.connection_status}
                </Text>
              </td>
              <td style={{ padding: 8, textAlign: "right" }}>
                <Button
                  size="sm"
                  variant="secondary"
                  icon={<IconTrash size={14} />}
                  onClick={() => removeDevice.mutate(device.serial_number)}
                  disabled={removeDevice.isPending}
                >
                  {_(msg`Remove`)}
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

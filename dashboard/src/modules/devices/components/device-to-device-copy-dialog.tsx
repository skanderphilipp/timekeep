import { useState } from "react";
import { useLingui } from "@lingui/react";
import { msg } from "@lingui/core/macro";

import {
  Dialog,
  Form,
  FormActions,
  Button,
  Select,
  Text,
} from "@/components/ui";
import type { DeviceSummary } from "@/lib/api";
import { useDeviceList } from "../hooks/use-device-list";
import { useDeviceActions } from "../hooks/use-device-actions";

type DeviceToDeviceCopyDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  targetSn: string;
};

/**
 * Device-to-device copy dialog — select a source device to copy users from.
 *
 * Fetches the device list, excludes the current device, and presents
 * them as a select dropdown. On confirm, calls sync-from endpoint.
 */
export function DeviceToDeviceCopyDialog({
  open,
  onOpenChange,
  targetSn,
}: DeviceToDeviceCopyDialogProps) {
  const { _ } = useLingui();
  const { devices } = useDeviceList();
  const { copyUsersFromDevice } = useDeviceActions(targetSn);
  const [sourceSn, setSourceSn] = useState("");

  const sourceOptions = devices
    .filter((d: DeviceSummary) => d.serial_number !== targetSn)
    .map((d: DeviceSummary) => ({
      value: d.serial_number,
      label: `${d.label} (${d.serial_number})`,
    }));

  const handleSubmit = () => {
    if (!sourceSn) return;
    copyUsersFromDevice.mutate(sourceSn, {
      onSuccess: () => {
        setSourceSn("");
        onOpenChange(false);
      },
    });
  };

  const handleClose = (open: boolean) => {
    if (!open) setSourceSn("");
    onOpenChange(open);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={handleClose}
      title={_(msg`Copy Users from Device`)}
      description={_(msg`Select a source device to copy its enrolled users to this device.`)}
    >
      <Form onSubmit={(e) => { e.preventDefault(); handleSubmit(); }}>
        <Select
          label={_(msg`Source Device`)}
          required
          placeholder={_(msg`Select a device…`)}
          options={sourceOptions}
          value={sourceSn}
          onChange={setSourceSn}
          fullWidth
        />

        {sourceOptions.length === 0 && (
          <Text variant="caption" color="tertiary">
            {_(msg`No other devices available as source. Add another device first.`)}
          </Text>
        )}

        {copyUsersFromDevice.error && (
          <Text variant="caption" color="danger">
            {_(msg`Copy failed. Check that both devices are online and try again.`)}
          </Text>
        )}

        <FormActions>
          <Button variant="secondary" onClick={() => handleClose(false)} disabled={copyUsersFromDevice.isPending}>
            {_(msg`Cancel`)}
          </Button>
          <Button
            variant="primary"
            onClick={handleSubmit}
            loading={copyUsersFromDevice.isPending}
            disabled={!sourceSn}
          >
            {_(msg`Copy Users`)}
          </Button>
        </FormActions>
      </Form>
    </Dialog>
  );
}

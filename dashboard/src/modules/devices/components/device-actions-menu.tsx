import { useState } from "react";
import { useLingui } from "@lingui/react";
import { msg } from "@lingui/core/macro";
import {
  IconDotsVertical,
  IconRefresh,
  IconClock,
  IconPower,
  IconTrash,
  IconDeviceMobile,
} from "@tabler/icons-react";

import {
  IconButton,
  Dropdown,
  MenuItem,
  MenuSeparator,
  ConfirmDialog,
} from "@/components/ui";
import { useDeviceActions } from "../hooks/use-device-actions";

type DeviceActionsMenuProps = {
  deviceSn: string;
  deviceLabel: string;
  canSyncClock: boolean;
  canRestart: boolean;
  onRefresh: () => void;
};

type ConfirmAction = "restart" | "sync_clock" | "delete" | null;

/**
 * Device actions menu — ⋮ dropdown with all device utility operations.
 *
 * Pull Attendance lives as a primary button in the status bar (not here).
 * Destructive operations (Restart, Delete) show confirmation dialogs.
 * All mutations come from the unified {@link useDeviceActions} hook.
 */
export function DeviceActionsMenu({
  deviceSn,
  deviceLabel,
  canSyncClock,
  canRestart,
  onRefresh,
}: DeviceActionsMenuProps) {
  const { _ } = useLingui();
  const { restart, syncClock, refreshInfo, delete: deleteDevice } = useDeviceActions(deviceSn);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null);

  return (
    <>
      <Dropdown
        trigger={
          <IconButton aria-label={_(msg`Device actions`)} accent="secondary">
            <IconDotsVertical size={16} />
          </IconButton>
        }
        side="bottom"
        align="end"
      >
        <MenuItem
          leftIcon={<IconRefresh size={16} />}
          label={_(msg`Refresh Data`)}
          onClick={onRefresh}
          title={_(msg`Reload device data from the server. No device interaction.`)}
        />
        <MenuItem
          leftIcon={<IconClock size={16} />}
          label={
            canSyncClock
              ? _(msg`Sync Clock`)
              : _(msg`Sync Clock (requires SDK)`)
          }
          onClick={() => setConfirmAction("sync_clock")}
          disabled={!canSyncClock}
          title={canSyncClock ? _(msg`Live SDK operation: set device clock to match server time.`) : undefined}
        />
        <MenuItem
          leftIcon={<IconDeviceMobile size={16} />}
          label={
            canSyncClock
              ? _(msg`Refresh Device Info`)
              : _(msg`Refresh Device Info (requires SDK)`)
          }
          onClick={() => refreshInfo.mutate()}
          disabled={!canSyncClock || refreshInfo.isPending}
          title={canSyncClock ? _(msg`Live SDK operation: pull user count, storage, firmware, and capacity from device.`) : undefined}
        />
        <MenuSeparator />
        <MenuItem
          leftIcon={<IconPower size={16} />}
          label={
            canRestart
              ? _(msg`Restart Device`)
              : _(msg`Restart Device (requires SDK)`)
          }
          onClick={() => setConfirmAction("restart")}
          variant="danger"
          disabled={!canRestart}
          title={canRestart ? _(msg`Live SDK operation: reboot the physical device. Device will be offline for ~30 seconds.`) : undefined}
        />
        <MenuSeparator />
        <MenuItem
          leftIcon={<IconTrash size={16} />}
          label={_(msg`Delete Device`)}
          onClick={() => setConfirmAction("delete")}
          variant="danger"
          title={_(msg`Database-only operation: remove device registration. Does not affect the physical device.`)}
        />
      </Dropdown>

      <ConfirmDialog
        open={confirmAction === "restart"}
        onOpenChange={(open) => setConfirmAction(open ? "restart" : null)}
        title={_(msg`Restart Device`)}
        message={_(
          msg`The device will reboot and be offline for about 30–60 seconds. Attendance records already stored on the device are safe.`,
        )}
        confirmLabel={_(msg`Restart`)}
        variant="danger"
        isPending={restart.isPending}
        onConfirm={() => restart.mutate()}
      />

      <ConfirmDialog
        open={confirmAction === "sync_clock"}
        onOpenChange={(open) => setConfirmAction(open ? "sync_clock" : null)}
        title={_(msg`Sync Clock`)}
        message={_(
          msg`This will set the device clock to match the server time. Any existing attendance records will be unaffected.`,
        )}
        confirmLabel={_(msg`Sync`)}
        isPending={syncClock.isPending}
        onConfirm={() => syncClock.mutate()}
      />

      <ConfirmDialog
        open={confirmAction === "delete"}
        onOpenChange={(open) => setConfirmAction(open ? "delete" : null)}
        title={_(msg`Delete Device`)}
        message={_(
          msg`Are you sure you want to remove "${deviceLabel}"? This action cannot be undone.`,
        )}
        confirmLabel={_(msg`Delete`)}
        variant="danger"
        isPending={deleteDevice.isPending}
        onConfirm={() =>
          deleteDevice.mutate(undefined, {
            onSuccess: () => setConfirmAction(null),
          })
        }
      />
    </>
  );
}

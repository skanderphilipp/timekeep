import { useState } from "react";
import { useLingui } from "@lingui/react";
import { msg } from "@lingui/core/macro";
import {
  IconDotsVertical,
  IconRefresh,
  IconClock,
  IconPower,
  IconCloudUpload,
  IconTrash,
} from "@tabler/icons-react";

import {
  IconButton,
  Dropdown,
  MenuItem,
  MenuSeparator,
  ConfirmDialog,
} from "@/components/ui";
import { useDeviceCommand } from "../hooks/use-device-command";
import { useSyncActions } from "../hooks/use-sync-actions";
import { useDeleteDevice } from "../hooks/use-delete-device";

type DeviceActionsMenuProps = {
  deviceSn: string;
  deviceLabel: string;
  canSyncClock: boolean;
  canRestart: boolean;
  onRefresh: () => void;
};

type ConfirmAction = "restart" | "sync_clock" | "resync" | "delete" | null;

/**
 * Device actions menu — dropdown with all device utility operations.
 *
 * Dangerous or impactful operations (Restart, Full Re-sync, Delete) show
 * confirmation dialogs before executing. Refresh triggers the parent's
 * refetch callback.
 */
export function DeviceActionsMenu({
  deviceSn,
  deviceLabel,
  canSyncClock,
  canRestart,
  onRefresh,
}: DeviceActionsMenuProps) {
  const { _ } = useLingui();
  const { restart, syncClock } = useDeviceCommand(deviceSn);
  const { resync } = useSyncActions(deviceSn);
  const deleteMutation = useDeleteDevice();
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
        />
        <MenuSeparator />
        <MenuItem
          leftIcon={<IconCloudUpload size={16} />}
          label={_(msg`Full Re-sync`)}
          onClick={() => setConfirmAction("resync")}
        />
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
        />
        <MenuSeparator />
        <MenuItem
          leftIcon={<IconTrash size={16} />}
          label={_(msg`Delete Device`)}
          onClick={() => setConfirmAction("delete")}
          variant="danger"
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
        open={confirmAction === "resync"}
        onOpenChange={(open) => setConfirmAction(open ? "resync" : null)}
        title={_(msg`Full Re-sync`)}
        message={_(
          msg`This will pull all users and attendance records from the device and push any pending changes. The device will remain online during this operation.`,
        )}
        confirmLabel={_(msg`Re-sync`)}
        isPending={resync.isPending}
        onConfirm={() => resync.mutate(undefined)}
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
        isPending={deleteMutation.isPending}
        onConfirm={() => deleteMutation.mutate(deviceSn)}
      />
    </>
  );
}

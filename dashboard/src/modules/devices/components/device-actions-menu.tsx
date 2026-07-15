import { useState } from "react";
import { useLingui } from "@lingui/react";
import { msg } from "@lingui/core/macro";
import {
  IconDotsVertical,
  IconRefresh,
  IconClock,
  IconPower,
} from "@tabler/icons-react";

import {
  IconButton,
  Dropdown,
  MenuItem,
  MenuSeparator,
  ConfirmDialog,
} from "@/components/ui";
import { useDeviceCommand } from "../hooks/use-device-command";

type DeviceActionsMenuProps = {
  deviceSn: string;
  onRefresh: () => void;
};

/**
 * Device actions menu — dropdown with Restart, Sync Clock, Refresh Data.
 *
 * Uses `DeviceActionsMenu` for destructive/impactful operations with
 * confirmation dialogs. Refresh triggers the parent's refetch callback.
 */
export function DeviceActionsMenu({ deviceSn, onRefresh }: DeviceActionsMenuProps) {
  const { _ } = useLingui();
  const { restart, syncClock } = useDeviceCommand(deviceSn);
  const [confirmAction, setConfirmAction] = useState<"restart" | "sync_clock" | null>(null);

  const handleRestart = () => restart.mutate();
  const handleSyncClock = () => syncClock.mutate();
  const handleRefresh = () => {
    onRefresh();
  };

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
          onClick={handleRefresh}
        />
        <MenuItem
          leftIcon={<IconClock size={16} />}
          label={_(msg`Sync Clock`)}
          onClick={() => setConfirmAction("sync_clock")}
        />
        <MenuSeparator />
        <MenuItem
          leftIcon={<IconPower size={16} />}
          label={_(msg`Restart Device`)}
          onClick={() => setConfirmAction("restart")}
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
        onConfirm={handleRestart}
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
        onConfirm={handleSyncClock}
      />
    </>
  );
}

import { useState } from "react";
import { useLingui } from "@lingui/react";
import { msg } from "@lingui/core/macro";
import { IconRefresh } from "@tabler/icons-react";

import { Button, ConfirmDialog } from "@/components/ui";
import { useSyncActions } from "../hooks/use-sync-actions";

type UserSyncActionsProps = {
  deviceSn: string;
};

/**
 * User sync actions — Resync button with confirmation dialog.
 *
 * Uses `useSyncActions` for the resync mutation.
 * Device-to-device copy and enrollment are handled by their own dialogs.
 */
export function UserSyncActions({ deviceSn }: UserSyncActionsProps) {
  const { _ } = useLingui();
  const { resync } = useSyncActions(deviceSn);
  const [showResync, setShowResync] = useState(false);

  const handleResync = () => {
    resync.mutate(undefined, { onSuccess: () => setShowResync(false) });
  };

  return (
    <>
      <Button
        variant="secondary"
        size="sm"
        icon={<IconRefresh size={16} />}
        onClick={() => setShowResync(true)}
        loading={resync.isPending}
      >
        {_(msg`Resync Device`)}
      </Button>

      <ConfirmDialog
        open={showResync}
        onOpenChange={setShowResync}
        title={_(msg`Resync Device`)}
        message={_(
          msg`This will pull all users and attendance records from the device and push any pending changes. The device will remain online during this operation.`,
        )}
        confirmLabel={_(msg`Resync`)}
        isPending={resync.isPending}
        onConfirm={handleResync}
      />
    </>
  );
}

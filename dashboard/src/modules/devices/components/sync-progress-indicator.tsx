import { useLingui } from "@lingui/react";
import { msg } from "@lingui/core/macro";
import { IconCheck, IconX, IconLoader } from "@tabler/icons-react";

import { Badge } from "@/components/ui";

type SyncProgressIndicatorProps = {
  /** Whether a sync operation is currently in progress. */
  isPending: boolean;
  /** Whether the last operation succeeded. */
  isSuccess: boolean;
  /** Whether the last operation failed. */
  isError: boolean;
  /** Number of items pushed (when available). */
  pushedCount?: number;
  /** Number of items deleted (when available). */
  deletedCount?: number;
  /** Number of items that failed (when available). */
  failedCount?: number;
};

/**
 * Sync progress indicator — shows mutation status with counts.
 *
 * Displays inline after a sync/resync/enroll operation:
 * - Pending: loading spinner
 * - Success: check with push/delete/fail counts
 * - Error: X with failure message
 *
 * Pure presentational — all state is passed as props.
 */
export function SyncProgressIndicator({
  isPending,
  isSuccess,
  isError,
  pushedCount,
  deletedCount,
  failedCount,
}: SyncProgressIndicatorProps) {
  const { _ } = useLingui();

  if (isPending) {
    return (
      <Badge variant="info" size="sm">
        <IconLoader size={12} />
        {_(msg`Syncing…`)}
      </Badge>
    );
  }

  if (isSuccess) {
    const parts: string[] = [];
    if (pushedCount !== undefined) parts.push(`${pushedCount} pushed`);
    if (deletedCount !== undefined) parts.push(`${deletedCount} removed`);
    if (failedCount !== undefined && failedCount > 0) parts.push(`${failedCount} failed`);

    return (
      <Badge variant="success" size="sm">
        <IconCheck size={12} />
        {parts.length > 0 ? parts.join(", ") : _(msg`Done`)}
      </Badge>
    );
  }

  if (isError) {
    return (
      <Badge variant="danger" size="sm">
        <IconX size={12} />
        {_(msg`Failed`)}
      </Badge>
    );
  }

  return null;
}

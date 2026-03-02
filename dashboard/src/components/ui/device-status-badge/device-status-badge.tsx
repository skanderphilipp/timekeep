import { clsx } from "clsx";
import { useLingui } from "@lingui/react";
import { msg } from "@lingui/core/macro";

import { type DeviceStatusValue } from "@shared/device-statuses";
import { getDeviceStatusUI } from "@/lib/device-status-ui";

import styles from "./device-status-badge.module.scss";

type DeviceStatusBadgeProps = {
  /** Canonical device status from the backend. */
  status: DeviceStatusValue;
  /** Whether to show the pulsing green dot for online. */
  pulsing?: boolean;
  className?: string;
};

/**
 * Device status badge — combines a StatusDot with a colored text label.
 *
 * Status definitions come from the shared catalog (`@shared/device-statuses`).
 * UI variant mapping is in `@/lib/device-status-ui`.
 */
export function DeviceStatusBadge({
  status,
  pulsing = false,
  className,
}: DeviceStatusBadgeProps) {
  const { _ } = useLingui();
  const ui = getDeviceStatusUI(status);

  const STATUS_LABELS: Record<DeviceStatusValue, string> = {
    online: _(msg`Online`),
    offline: _(msg`Offline`),
    syncing: _(msg`Syncing`),
    error: _(msg`Error`),
    provisioning: _(msg`Provisioning`),
    decommissioned: _(msg`Decommissioned`),
  };
  const label = STATUS_LABELS[status] ?? STATUS_LABELS.offline;
  const showPulse = pulsing && status === "online";

  return (
    <span
      data-slot="device-status-badge"
      data-status={status}
      className={clsx(styles.badge, styles[ui.variant], className)}
    >
      <span
        data-slot="status-dot"
        data-status={ui.dotColor}
        className={clsx(
          styles.dot,
          styles[`dot-${ui.dotColor}`],
          showPulse && styles.pulsing,
        )}
        aria-hidden="true"
      />
      <span>{label}</span>
    </span>
  );
}

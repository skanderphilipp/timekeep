import { useNavigate, useParams } from "react-router-dom";
import {
  IconPencil,
  IconTrash,
  IconFingerprint,
  IconUsers,
  IconRefresh,
  IconClock,
  IconCloudUpload,
} from "@tabler/icons-react";
import { useLingui } from "@lingui/react";
import { msg } from "@lingui/core/macro";

import { useRegisterCommands } from "@/infrastructure/commands";
import { useToast } from "@/infrastructure/toast/toast";
import { AppRoute } from "@/lib/navigation";
import {
  syncDeviceClock,
  resyncDevice,
  deleteDevice,
  enrollFinger,
} from "@/lib/api/devices";

/**
 * Registers contextual commands for the device detail page.
 *
 * These commands appear first in the Cmd+K palette when the user is
 * viewing a specific device, before the global commands.
 */
export function useDeviceDetailCommands() {
  const { _ } = useLingui();
  const navigate = useNavigate();
  const toast = useToast();
  const { sn } = useParams<{ sn: string }>();

  if (!sn) return;

  useRegisterCommands("devices.detail", [
    {
      id: "device-detail-edit",
      label: _(msg`Edit Device`),
      description: _(msg`Modify device configuration`),
      icon: IconPencil,
      keywords: ["config", "modify", "settings"],
      scope: { type: "page", pageId: "devices.detail" },
      action: () => navigate(AppRoute.devices.edit(sn)),
    },
    {
      id: "device-detail-view-punches",
      label: _(msg`View Punches`),
      description: _(msg`Attendance records for this device`),
      icon: IconFingerprint,
      keywords: ["attendance", "records", "punches"],
      scope: { type: "page", pageId: "devices.detail" },
      action: () => navigate(AppRoute.attendance.byDevice(sn)),
    },
    {
      id: "device-detail-view-users",
      label: _(msg`View Device Users`),
      description: _(msg`Employees enrolled on this device`),
      icon: IconUsers,
      keywords: ["enrolled", "employees", "personnel"],
      scope: { type: "page", pageId: "devices.detail" },
      /**
       * TODO(ENTERPRISE): Navigate to device users tab or dedicated view
       *
       * Phase: Polish (before v1.0)
       * Impact: Currently navigates to device detail; should scroll to Users tab
       *         or open a focused view.
       * Fix: Open the users tab via URL hash (#users) or state management.
       */
      action: () => navigate(AppRoute.devices.detail(sn)),
    },
    {
      id: "device-detail-sync-clock",
      label: _(msg`Sync Clock`),
      description: _(msg`Synchronize device clock with server. Runs via SDK if connected, falls back to ADMS.`),
      icon: IconClock,
      keywords: ["time", "sync", "synchronize", "ntp"],
      scope: { type: "page", pageId: "devices.detail" },
      action: () => {
        syncDeviceClock(sn)
          .then(() => toast.success(_(msg`Clock sync triggered. Device will update on next poll.`)))
          .catch(() => toast.error(_(msg`Failed to sync device clock.`)));
      },
    },
    {
      id: "device-detail-resync",
      label: _(msg`Full Re-sync`),
      description: _(msg`Delete all users from device, then re-upload employee database. Runs asynchronously.`),
      icon: IconCloudUpload,
      keywords: ["sync", "upload", "pull", "reload"],
      scope: { type: "page", pageId: "devices.detail" },
      action: () => {
        resyncDevice(sn)
          .then(() => toast.success(_(msg`Re-sync started. Device users will refresh shortly.`)))
          .catch(() => toast.error(_(msg`Failed to start re-sync.`)));
      },
    },
    {
      id: "device-detail-enroll-finger",
      label: _(msg`Enroll Fingerprint`),
      description: _(msg`Start fingerprint enrollment on this device. Employee must place finger 3 times on scanner.`),
      icon: IconFingerprint,
      keywords: ["finger", "biometric", "enroll", "scan"],
      scope: { type: "page", pageId: "devices.detail" },
      /**
       * Enrollment is a multi-step async process:
       * 1. This command publishes FingerprintEnrollRequested
       * 2. Backend handler enables real-time events, starts 3-sample capture
       * 3. Employee places finger on device (10-30 seconds)
       * 4. Template downloaded and stored centrally
       * 5. FingerprintEnrolled event fires
       *
       * TODO(ENTERPRISE): Add enrollment progress UI with SSE listener.
       *
       * Phase: Production hardening
       * Impact: User has no feedback after triggering enrollment.
       * Fix: Subscribe to onboarding SSE or poll device users endpoint.
       */
      action: () => {
        const pin = window.prompt(_(msg`Enter employee PIN to enroll:`));
        if (!pin) return;

        enrollFinger(sn, pin, 0)
          .then(() =>
            toast.success(
              _(msg`Enrollment started. Ask the employee to place their finger on the device three times.`),
            ),
          )
          .catch(() => toast.error(_(msg`Failed to start fingerprint enrollment.`)));
      },
    },
    {
      id: "device-detail-delete",
      label: _(msg`Delete Device`),
      description: _(msg`Remove this device from the system permanently.`),
      icon: IconTrash,
      keywords: ["remove", "unregister", "delete"],
      scope: { type: "page", pageId: "devices.detail" },
      action: () => {
        if (!window.confirm(_(msg`Delete this device? This cannot be undone.`))) return;

        deleteDevice(sn)
          .then(() => {
            toast.success(_(msg`Device deleted.`));
            navigate(AppRoute.devices.list);
          })
          .catch(() => toast.error(_(msg`Failed to delete device.`)));
      },
    },
    {
      id: "device-detail-refresh",
      label: _(msg`Refresh Device`),
      description: _(msg`Reload device data from server`),
      icon: IconRefresh,
      keywords: ["reload", "refresh"],
      scope: { type: "page", pageId: "devices.detail" },
      action: () => window.location.reload(),
    },
  ]);
}

import { useNavigate, useParams } from "react-router-dom";
import {
  IconPencil,
  IconTrash,
  IconFingerprint,
  IconUsers,
  IconRefresh,
  IconClock,
  IconCloudDownload,
} from "@tabler/icons-react";
import { useLingui } from "@lingui/react";
import { msg } from "@lingui/core/macro";

import { useRegisterCommands } from "@/infrastructure/commands";
import { useToast } from "@/infrastructure/toast/toast";
import { AppRoute } from "@/lib/navigation";
import { useDeviceActions } from "./use-device-actions";

/**
 * Registers contextual commands for the device detail page (Cmd+K palette).
 *
 * All device operations delegate to {@link useDeviceActions} mutations,
 * so they share the same loading states and cache invalidation as the buttons.
 * No raw API calls — every command has proper loading, error handling,
 * and query invalidation.
 */
export function useDeviceDetailCommands() {
  const { _ } = useLingui();
  const navigate = useNavigate();
  const toast = useToast();
  const { sn } = useParams<{ sn: string }>();

  if (!sn) return;

  // eslint-disable-next-line react-hooks/rules-of-hooks
  const {
    pullAttendance,
    syncClock,
    refreshInfo,
    refreshUsers,
    enrollFingerprint,
    delete: deleteDevice,
  } = useDeviceActions(sn);

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
      id: "device-detail-pull-attendance",
      label: _(msg`Pull Attendance`),
      description: _(msg`Fetch attendance records from the device now`),
      icon: IconCloudDownload,
      keywords: ["attendance", "records", "pull", "fetch"],
      scope: { type: "page", pageId: "devices.detail" },
      action: () => {
        pullAttendance.mutate(undefined, {
          onSuccess: () => toast.success(_(msg`Attendance pull started.`)),
          onError: () => toast.error(_(msg`Failed to pull attendance.`)),
        });
      },
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
      action: () => navigate(AppRoute.devices.detail(sn)),
    },
    {
      id: "device-detail-sync-clock",
      label: _(msg`Sync Clock`),
      description: _(msg`Set device clock to match server time`),
      icon: IconClock,
      keywords: ["time", "sync", "synchronize", "ntp"],
      scope: { type: "page", pageId: "devices.detail" },
      action: () => {
        syncClock.mutate(undefined, {
          onSuccess: () => toast.success(_(msg`Clock sync triggered.`)),
          onError: () => toast.error(_(msg`Failed to sync device clock.`)),
        });
      },
    },
    {
      id: "device-detail-refresh-info",
      label: _(msg`Refresh Device Info`),
      description: _(msg`Pull live metadata from device (counts, capacity, firmware)`),
      icon: IconRefresh,
      keywords: ["info", "refresh", "capacity", "firmware"],
      scope: { type: "page", pageId: "devices.detail" },
      action: () => {
        refreshInfo.mutate(undefined, {
          onSuccess: () => toast.success(_(msg`Device info refreshed.`)),
          onError: () => toast.error(_(msg`Failed to refresh device info.`)),
        });
      },
    },
    {
      id: "device-detail-refresh-users",
      label: _(msg`Refresh Users from Device`),
      description: _(msg`Pull live user list from device and update local database`),
      icon: IconUsers,
      keywords: ["users", "refresh", "pull", "sync"],
      scope: { type: "page", pageId: "devices.detail" },
      action: () => {
        refreshUsers.mutate(undefined, {
          onSuccess: () => toast.success(_(msg`User list refreshed from device.`)),
          onError: () => toast.error(_(msg`Failed to refresh user list.`)),
        });
      },
    },
    {
      id: "device-detail-enroll-finger",
      label: _(msg`Enroll Fingerprint`),
      description: _(msg`Start fingerprint enrollment. Employee must place finger 3 times on scanner.`),
      icon: IconFingerprint,
      keywords: ["finger", "biometric", "enroll", "scan"],
      scope: { type: "page", pageId: "devices.detail" },
      action: () => {
        const pin = window.prompt(_(msg`Enter employee PIN to enroll:`));
        if (!pin) return;

        enrollFingerprint.mutate(pin, {
          onSuccess: () =>
            toast.success(
              _(msg`Enrollment started. Ask the employee to place their finger on the device three times.`),
            ),
          onError: () => toast.error(_(msg`Failed to start fingerprint enrollment.`)),
        });
      },
    },
    {
      id: "device-detail-delete",
      label: _(msg`Delete Device`),
      description: _(msg`Remove this device from the system permanently`),
      icon: IconTrash,
      keywords: ["remove", "unregister", "delete"],
      scope: { type: "page", pageId: "devices.detail" },
      action: () => {
        if (!window.confirm(_(msg`Delete this device? This cannot be undone.`))) return;

        deleteDevice.mutate(undefined, {
          onSuccess: () => {
            toast.success(_(msg`Device deleted.`));
            navigate(AppRoute.devices.list);
          },
          onError: () => toast.error(_(msg`Failed to delete device.`)),
        });
      },
    },
    {
      id: "device-detail-refresh-page",
      label: _(msg`Refresh Page`),
      description: _(msg`Reload device data from server`),
      icon: IconRefresh,
      keywords: ["reload", "refresh"],
      scope: { type: "page", pageId: "devices.detail" },
      /**
       * TODO(ENTERPRISE): Replace location.reload with queryClient.invalidate
       *
       * Phase: Device management polish
       * Impact: Full page reload kills SPA experience and loses UI state.
       * Fix: Invalidate all device-related query keys instead.
       */
      action: () => window.location.reload(),
    },
  ]);
}

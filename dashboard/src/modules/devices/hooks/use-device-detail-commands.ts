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
import { AppRoute } from "@/lib/navigation";

/**
 * Registers contextual commands for the device detail page.
 *
 * These commands appear first in the Cmd+K palette when the user is
 * viewing a specific device, before the global commands.
 */
export function useDeviceDetailCommands() {
  const { _ } = useLingui();
  const navigate = useNavigate();
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
      description: _(msg`Synchronize device clock with server`),
      icon: IconClock,
      keywords: ["time", "sync", "synchronize"],
      scope: { type: "page", pageId: "devices.detail" },
      /**
       * TODO(ENTERPRISE): Call syncDeviceClock API and show toast
       *
       * Phase: Production hardening (before tenant onboarding)
       * Impact: Command reloads page; should call syncDeviceClock(sn) and show
       *         success/error toast without full page reload.
       * Fix: Import syncDeviceClock from @/lib/api/devices, call with try/catch,
       *       use toast notification for result.
       */
      action: () => window.location.reload(),
    },
    {
      id: "device-detail-resync",
      label: _(msg`Full Re-sync`),
      description: _(msg`Re-sync all users and records on this device`),
      icon: IconCloudUpload,
      keywords: ["sync", "upload", "pull"],
      scope: { type: "page", pageId: "devices.detail" },
      /**
       * TODO(ENTERPRISE): Call resyncDevice API and show toast
       *
       * Phase: Production hardening (before tenant onboarding)
       * Impact: Command reloads page; should call resyncDevice(sn) and show
       *         success/error toast without full page reload.
       * Fix: Import resyncDevice from @/lib/api/devices, call with try/catch,
       *       use toast notification for result.
       */
      action: () => window.location.reload(),
    },
    {
      id: "device-detail-delete",
      label: _(msg`Delete Device`),
      description: _(msg`Remove this device from the system`),
      icon: IconTrash,
      keywords: ["remove", "unregister", "delete"],
      scope: { type: "page", pageId: "devices.detail" },
      /**
       * TODO(ENTERPRISE): Show confirmation dialog before delete
       *
       * Phase: Production hardening (before tenant onboarding)
       * Impact: Navigates to device list; should show a confirmation dialog
       *         and call deleteDevice(sn) with error handling.
       * Fix: Open confirmation modal first, then call deleteDevice(sn),
       *       navigate to device list on success, show toast on error.
       */
      action: () => {
        if (window.confirm(`Delete device ${sn}?`)) {
          navigate(AppRoute.devices.list);
        }
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

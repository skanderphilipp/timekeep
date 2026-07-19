import { useNavigate, useParams } from "react-router-dom";
import {
  IconPencil,
  IconFingerprint,
  IconCloudUpload,
  IconCloudOff,
  IconUserOff,
  IconScan,
} from "@tabler/icons-react";
import { useLingui } from "@lingui/react";
import { msg } from "@lingui/core/macro";

import { useRegisterCommands } from "@/infrastructure/commands";
import { useToast } from "@/infrastructure/toast/toast";
import { AppRoute } from "@/lib/navigation";
import {
  syncEmployeeToDevices,
  removeEmployeeFromDevices,
  enrollFinger,
} from "@/lib/api/devices";
import { deactivateEmployee } from "@/lib/api/employees";

/**
 * Registers contextual commands for the employee detail page.
 *
 * These commands appear first in the Cmd+K palette when the user is
 * viewing a specific employee, before the global commands.
 */
export function useEmployeeDetailCommands() {
  const { _ } = useLingui();
  const navigate = useNavigate();
  const toast = useToast();
  const { id } = useParams<{ id: string }>();

  if (!id) return;

  useRegisterCommands("employees.detail", [
    {
      id: "employee-detail-edit",
      label: _(msg`Edit Employee`),
      description: _(msg`Modify employee details`),
      icon: IconPencil,
      keywords: ["modify", "update", "change"],
      scope: { type: "page", pageId: "employees.detail" },
      action: () => navigate(AppRoute.employees.edit(id)),
    },
    {
      id: "employee-detail-view-attendance",
      label: _(msg`View Attendance`),
      description: _(msg`Attendance records for this employee`),
      icon: IconFingerprint,
      keywords: ["attendance", "punches", "records", "history"],
      scope: { type: "page", pageId: "employees.detail" },
      action: () => navigate(AppRoute.attendance.list),
    },
    {
      id: "employee-detail-enroll-finger",
      label: _(msg`Enroll Fingerprint`),
      description: _(msg`Start fingerprint enrollment on a device. Employee must place finger 3 times on the scanner.`),
      icon: IconScan,
      keywords: ["finger", "biometric", "enroll", "scan", "onboard"],
      scope: { type: "page", pageId: "employees.detail" },
      /**
       * Multi-step async enrollment process:
       * 1. HR selects which device (typically the onboarding device)
       * 2. API publishes FingerprintEnrollRequested event
       * 3. Backend starts 3-sample capture loop on the device
       * 4. Employee places finger on the physical device
       * 5. Template downloaded and stored centrally
       * 6. HR clicks "Sync to Devices" to push fingerprint everywhere
       *
       * TODO(ENTERPRISE): Replace PIN/device prompt with auto-detection.
       * Phase: Production hardening
       * Fix: Use employee PIN from page data, auto-select onboarding device.
       */
      action: () => {
        const deviceSn = window.prompt(
          _(msg`Enter the device serial number (typically the onboarding device):`),
        );
        if (!deviceSn) return;

        const pin = window.prompt(_(msg`Enter the employee PIN:`));
        if (!pin) return;

        enrollFinger(deviceSn, pin, 0)
          .then(() =>
            toast.success(
              _(msg`Enrollment started. Ask the employee to place their finger on the scanner.`),
            ),
          )
          .catch(() => toast.error(_(msg`Failed to start fingerprint enrollment.`)));
      },
    },
    {
      id: "employee-detail-sync-devices",
      label: _(msg`Sync to Devices`),
      description: _(msg`Push employee data to all enrolled devices. Use after editing employee or enrolling fingerprints.`),
      icon: IconCloudUpload,
      keywords: ["sync", "push", "devices", "propagate"],
      scope: { type: "page", pageId: "employees.detail" },
      action: () => {
        syncEmployeeToDevices(id)
          .then(() => toast.success(_(msg`Employee sync started. Changes will appear on devices shortly.`)))
          .catch(() => toast.error(_(msg`Failed to sync employee to devices.`)));
      },
    },
    {
      id: "employee-detail-remove-devices",
      label: _(msg`Remove from Devices`),
      description: _(msg`Delete this employee from all enrolled devices. Fingerprints and PIN removed. Attendance records preserved.`),
      icon: IconCloudOff,
      keywords: ["unregister", "remove", "devices", "delete"],
      scope: { type: "page", pageId: "employees.detail" },
      action: () => {
        if (!window.confirm(_(msg`Remove this employee from ALL devices? This cannot be undone.`))) return;

        removeEmployeeFromDevices(id)
          .then(() => toast.success(_(msg`Employee removed from all devices.`)))
          .catch(() => toast.error(_(msg`Failed to remove employee from devices.`)));
      },
    },
    {
      id: "employee-detail-deactivate",
      label: _(msg`Deactivate Employee`),
      description: _(msg`Soft-delete this employee. They stop appearing in active lists and are not synced to devices.`),
      icon: IconUserOff,
      keywords: ["deactivate", "disable", "remove", "archive"],
      scope: { type: "page", pageId: "employees.detail" },
      action: () => {
        if (!window.confirm(_(msg`Deactivate this employee? They will no longer appear in active lists.`))) return;

        deactivateEmployee(id)
          .then(() => {
            toast.success(_(msg`Employee deactivated.`));
            navigate(AppRoute.employees.list);
          })
          .catch(() => toast.error(_(msg`Failed to deactivate employee.`)));
      },
    },
  ]);
}

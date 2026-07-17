import { useNavigate, useParams } from "react-router-dom";
import {
  IconPencil,
  IconFingerprint,
  IconCloudUpload,
  IconCloudOff,
  IconUserOff,
} from "@tabler/icons-react";
import { useLingui } from "@lingui/react";
import { msg } from "@lingui/core/macro";

import { useRegisterCommands } from "@/infrastructure/commands";
import { AppRoute } from "@/lib/navigation";

/**
 * Registers contextual commands for the employee detail page.
 *
 * These commands appear first in the Cmd+K palette when the user is
 * viewing a specific employee, before the global commands.
 */
export function useEmployeeDetailCommands() {
  const { _ } = useLingui();
  const navigate = useNavigate();
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
      /**
       * TODO(ENTERPRISE): Use employee PIN for attendance filter, not UUID
       *
       * Phase: Polish (before v1.0)
       * Impact: Navigates to attendance list without pre-filtering; the
       *         attendance endpoint filters by user_pin, not employee UUID.
       * Fix: Resolve the employee's PIN from the current page data and
       *      navigate to /attendance?user_pin={pin}.
       */
      action: () => navigate(AppRoute.attendance.list),
    },
    {
      id: "employee-detail-sync-devices",
      label: _(msg`Sync to Devices`),
      description: _(msg`Push employee data to enrolled devices`),
      icon: IconCloudUpload,
      keywords: ["sync", "push", "devices"],
      scope: { type: "page", pageId: "employees.detail" },
      /**
       * TODO(ENTERPRISE): Call syncEmployeeToDevices API and show toast
       *
       * Phase: Production hardening (before tenant onboarding)
       * Impact: Reloads page; should call syncEmployeeToDevices(id) and show
       *         success/error toast without full page reload.
       * Fix: Import syncEmployeeToDevices from @/lib/api/devices,
       *       call with try/catch, use toast notification for result.
       */
      action: () => window.location.reload(),
    },
    {
      id: "employee-detail-remove-devices",
      label: _(msg`Remove from Devices`),
      description: _(msg`Remove employee from all enrolled devices`),
      icon: IconCloudOff,
      keywords: ["unregister", "remove", "devices"],
      scope: { type: "page", pageId: "employees.detail" },
      /**
       * TODO(ENTERPRISE): Show confirmation dialog and call removeEmployeeFromDevices API
       *
       * Phase: Production hardening (before tenant onboarding)
       * Impact: Reloads page; should show confirmation dialog and call
       *         removeEmployeeFromDevices(id) with toast feedback.
       * Fix: Import removeEmployeeFromDevices from @/lib/api/devices,
       *       show confirm dialog, call API, show toast.
       */
      action: () => {
        if (window.confirm(`Remove employee from all devices?`)) {
          window.location.reload();
        }
      },
    },
    {
      id: "employee-detail-deactivate",
      label: _(msg`Deactivate Employee`),
      description: _(msg`Soft-delete this employee`),
      icon: IconUserOff,
      keywords: ["deactivate", "disable", "remove"],
      scope: { type: "page", pageId: "employees.detail" },
      /**
       * TODO(ENTERPRISE): Show confirmation dialog and call deactivateEmployee API
       *
       * Phase: Production hardening (before tenant onboarding)
       * Impact: Navigates to employee list; should show confirmation dialog
       *         and call deactivateEmployee(id) with toast feedback.
       * Fix: Import deactivateEmployee from @/lib/api/employees,
       *       show confirm dialog, call API, navigate on success, show toast on error.
       */
      action: () => {
        if (window.confirm(`Deactivate this employee?`)) {
          navigate(AppRoute.employees.list);
        }
      },
    },
  ]);
}

import { useNavigate } from "react-router-dom";
import { IconFingerprint, IconDevices, IconUsers, IconRefresh } from "@tabler/icons-react";
import { useLingui } from "@lingui/react";
import { msg } from "@lingui/core/macro";

import { useRegisterCommands } from "@/infrastructure/commands";
import { AppRoute } from "@/lib/navigation";

/**
 * Registers contextual commands for the dashboard page.
 *
 * These commands appear first in the Cmd+K palette when the user is
 * on the dashboard, before the global commands.
 */
export function useDashboardCommands() {
  const { _ } = useLingui();
  const navigate = useNavigate();

  useRegisterCommands("dashboard", [
    {
      id: "dashboard-view-attendance",
      label: _(msg`View Attendance`),
      description: _(msg`View today's punch records`),
      icon: IconFingerprint,
      keywords: ["attendance", "punches", "records", "today"],
      scope: { type: "page", pageId: "dashboard" },
      action: () => navigate(AppRoute.attendance.list),
    },
    {
      id: "dashboard-view-devices",
      label: _(msg`View Devices`),
      description: _(msg`Manage biometric scanners`),
      icon: IconDevices,
      keywords: ["scanners", "hardware", "manage"],
      scope: { type: "page", pageId: "dashboard" },
      action: () => navigate(AppRoute.devices.list),
    },
    {
      id: "dashboard-view-employees",
      label: _(msg`View Employees`),
      description: _(msg`Manage employee directory`),
      icon: IconUsers,
      keywords: ["staff", "directory", "people"],
      scope: { type: "page", pageId: "dashboard" },
      action: () => navigate(AppRoute.employees.list),
    },
    {
      id: "dashboard-refresh",
      label: _(msg`Refresh Dashboard`),
      description: _(msg`Reload dashboard data from server`),
      icon: IconRefresh,
      keywords: ["reload", "refresh"],
      scope: { type: "page", pageId: "dashboard" },
      action: () => window.location.reload(),
    },
  ]);
}

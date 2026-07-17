import { useNavigate } from "react-router-dom";
import { IconPlus, IconRefresh } from "@tabler/icons-react";
import { useLingui } from "@lingui/react";
import { msg } from "@lingui/core/macro";

import { useRegisterCommands } from "@/infrastructure/commands";
import { AppRoute } from "@/lib/navigation";

/**
 * Registers contextual commands for the employee list page.
 *
 * These commands appear first in the Cmd+K palette when the user is
 * on the employee list page, before the global commands.
 */
export function useEmployeeListCommands() {
  const { _ } = useLingui();
  const navigate = useNavigate();

  useRegisterCommands("employees.list", [
    {
      id: "employee-list-add",
      label: _(msg`Add Employee`),
      description: _(msg`Register a new employee`),
      icon: IconPlus,
      keywords: ["new", "register", "hire"],
      scope: { type: "page", pageId: "employees.list" },
      action: () => navigate(AppRoute.employees.new),
    },
    {
      id: "employee-list-refresh",
      label: _(msg`Refresh Employees`),
      description: _(msg`Reload employee list from server`),
      icon: IconRefresh,
      keywords: ["reload", "refresh"],
      scope: { type: "page", pageId: "employees.list" },
      action: () => window.location.reload(),
    },
  ]);
}

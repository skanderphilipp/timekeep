import { useNavigate } from "react-router-dom";
import { IconPlus, IconRefresh } from "@tabler/icons-react";
import { useLingui } from "@lingui/react";
import { msg } from "@lingui/core/macro";

import { useRegisterCommands } from "@/infrastructure/commands";
import { AppRoute } from "@/lib/navigation";

/**
 * Registers contextual commands for the device list page.
 *
 * These commands appear first in the Cmd+K palette when the user is
 * on the device list page, before the global commands.
 */
export function useDeviceListCommands() {
  const { _ } = useLingui();
  const navigate = useNavigate();

  useRegisterCommands("devices.list", [
    {
      id: "device-list-add",
      label: _(msg`Add Device`),
      description: _(msg`Register a new biometric scanner`),
      icon: IconPlus,
      keywords: ["new", "register"],
      scope: { type: "page", pageId: "devices.list" },
      action: () => navigate(AppRoute.devices.new),
    },
    {
      id: "device-list-refresh",
      label: _(msg`Refresh Devices`),
      description: _(msg`Reload device list from server`),
      icon: IconRefresh,
      keywords: ["reload"],
      scope: { type: "page", pageId: "devices.list" },
      action: () => window.location.reload(),
    },
  ]);
}

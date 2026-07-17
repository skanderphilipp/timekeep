import { useNavigate } from "react-router-dom";
import {
  IconDashboard,
  IconDevices,
  IconFingerprint,
  IconReport,
  IconSettings,
  IconPlus,
  IconUsers,
  IconKey,
  IconHistory,
} from "@tabler/icons-react";
import { useLingui } from "@lingui/react";
import { msg } from "@lingui/core/macro";

import { useRegisterCommands } from "./use-register-commands";
import { AppRoute } from "@/lib/navigation";
import type { Command } from "./command-types";

/**
 * Registers all global commands (available on every page).
 *
 * Mount once at the app root. Commands are registered into the central
 * registry and available to `SidePanelCmdk` via `useCommands()`.
 *
 * Contextual (page-specific) commands are registered by each individual
 * page component via `useRegisterCommands(pageId, [...])`.
 */
export function GlobalCommandsRegistrar() {
  const { _ } = useLingui();
  const navigate = useNavigate();

  const globalCommands: Command[] = [
    {
      id: "global-dashboard",
      label: _(msg`Dashboard`),
      description: _(msg`Attendance overview`),
      icon: IconDashboard,
      keywords: ["home", "overview"],
      scope: { type: "global" },
      action: () => navigate(AppRoute.dashboard),
    },
    {
      id: "global-devices",
      label: _(msg`Devices`),
      description: _(msg`Manage biometric scanners`),
      icon: IconDevices,
      keywords: ["scanner", "hardware"],
      scope: { type: "global" },
      action: () => navigate(AppRoute.devices.list),
    },
    {
      id: "global-devices-add",
      label: _(msg`Add Device`),
      description: _(msg`Register a new scanner`),
      icon: IconPlus,
      keywords: ["new", "register", "scanner"],
      scope: { type: "global" },
      action: () => navigate(AppRoute.devices.new),
    },
    {
      id: "global-punches",
      label: _(msg`Punch Records`),
      description: _(msg`View and query attendance data`),
      icon: IconFingerprint,
      keywords: ["attendance", "records", "check-in"],
      scope: { type: "global" },
      action: () => navigate(AppRoute.attendance.list),
    },
    {
      id: "global-users",
      label: _(msg`Users`),
      description: _(msg`Manage dashboard accounts`),
      icon: IconUsers,
      keywords: ["accounts", "roles", "admin"],
      scope: { type: "global" },
      action: () => navigate(AppRoute.settings.users),
    },
    {
      id: "global-api-keys",
      label: _(msg`API Keys`),
      description: _(msg`Manage integration keys`),
      icon: IconKey,
      keywords: ["integrations", "tokens"],
      scope: { type: "global" },
      action: () => navigate(AppRoute.settings.apiKeys),
    },
    {
      id: "global-audit-log",
      label: _(msg`Audit Log`),
      description: _(msg`View activity history`),
      icon: IconHistory,
      keywords: ["history", "activity", "events"],
      scope: { type: "global" },
      action: () => navigate(AppRoute.settings.audit),
    },
    {
      id: "global-reports",
      label: _(msg`Reports`),
      description: _(msg`Attendance reports and exports`),
      icon: IconReport,
      keywords: ["export", "csv", "summary"],
      scope: { type: "global" },
      action: () => navigate(AppRoute.reports),
    },
    {
      id: "global-settings",
      label: _(msg`Settings`),
      description: _(msg`Application configuration`),
      icon: IconSettings,
      keywords: ["config", "preferences"],
      scope: { type: "global" },
      action: () => navigate(AppRoute.settings.system),
    },
  ];

  useRegisterCommands("global", globalCommands);

  return null;
}

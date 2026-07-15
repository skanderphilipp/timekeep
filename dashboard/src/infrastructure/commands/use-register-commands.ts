import { useEffect } from "react";
import { useSetAtom } from "jotai";
import type { Command } from "./command-types";
import { registerCommandsAtom, unregisterCommandsAtom } from "./command-registry";

/**
 * Register contextual commands for a page.
 *
 * Call this hook at the top level of a page component. Commands are
 * registered on mount and cleaned up on unmount.
 *
 * @param key - The page id (e.g. `"devices.list"`) or `"global"` for global commands.
 * @param commands - The commands to register for this page/scope.
 *
 * @example
 * ```tsx
 * function DeviceListPage() {
 *   useRegisterCommands("devices.list", [
 *     {
 *       id: "device-add",
 *       label: _(msg`Add Device`),
 *       icon: IconPlus,
 *       keywords: ["new", "register"],
 *       scope: { type: "page", pageId: "devices.list" },
 *       action: () => navigate(AppRoute.devices.new),
 *     },
 *   ]);
 *   // ... page content
 * }
 * ```
 */
export function useRegisterCommands(key: string, commands: Command[]): void {
  const register = useSetAtom(registerCommandsAtom);
  const unregister = useSetAtom(unregisterCommandsAtom);

  useEffect(() => {
    register({ key, commands });
    return () => {
      unregister(key);
    };
  }, [key, commands, register, unregister]);
}

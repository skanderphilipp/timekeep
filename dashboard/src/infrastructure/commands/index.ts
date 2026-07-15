/**
 * Command Metadata System — central registry for the Cmd+K palette.
 *
 * Architecture:
 * - Pages register commands via `useRegisterCommands(pageId, commands)`
 * - `SidePanelCmdk` reads resolved commands via `useCommands()`
 * - Commands are grouped: contextual (current page) first, then global
 *
 * Usage:
 * ```tsx
 * // In a page component:
 * useRegisterCommands("devices.list", [{ id: "add", label: "Add Device", ... }]);
 *
 * // In SidePanelCmdk:
 * const { contextual, global, all } = useCommands();
 * ```
 */

export { type Command, type CommandScope, type PageId, PAGE_IDS } from "./command-types";
export { usePageContext, type PageContext as RoutePageContext } from "./use-page-context";
export {
  useCommands,
  resolveCommands,
  type ResolvedCommands,
  type PageContext,
} from "./use-commands";
export { useRegisterCommands } from "./use-register-commands";
export { readCommandRegistryAtom } from "./command-registry";
export { GlobalCommandsRegistrar } from "./global-commands-registrar";

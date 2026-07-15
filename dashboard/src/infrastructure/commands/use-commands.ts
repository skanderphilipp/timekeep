import { useMemo } from "react";
import { useAtomValue } from "jotai";
import { readCommandRegistryAtom } from "./command-registry";
import { usePageContext } from "./use-page-context";
import type { Command, CommandRegistry } from "./command-types";

// ── Pure resolution function ──────────────────────────────────────────────────

export type ResolvedCommands = {
  /** Commands relevant to the current page context. Shown first. */
  contextual: Command[];
  /** Commands available everywhere. Shown after contextual. */
  global: Command[];
  /** Flattened list of all resolved commands (contextual first, then global). */
  all: Command[];
};

export type PageContext = {
  pageId: string | null;
  matchesPrefix: (prefix: string) => boolean;
};

/**
 * Pure function: resolves commands from a registry given a page context.
 *
 * Exported for unit testing — prefer `useCommands()` in components.
 */
export function resolveCommands(
  registry: CommandRegistry,
  ctx: PageContext,
): ResolvedCommands {
  const global = registry["global"] ?? [];
  const contextual: Command[] = [];

  for (const [key, commands] of Object.entries(registry)) {
    if (key === "global") continue;
    if (!commands || commands.length === 0) continue;

    for (const cmd of commands) {
      const scope = cmd.scope;
      if (scope.type === "global") {
        contextual.push(cmd);
      } else if (scope.type === "page") {
        if (scope.pageId === ctx.pageId) {
          contextual.push(cmd);
        }
      } else if (scope.type === "pattern") {
        if (ctx.matchesPrefix(scope.pattern)) {
          contextual.push(cmd);
        }
      }
    }
  }

  return {
    contextual,
    global,
    all: [...contextual, ...global],
  };
}

// ── Hook ───────────────────────────────────────────────────────────────────────

/**
 * Resolves commands from the registry for the current page context.
 *
 * Reads the central `commandRegistryAtom`, applies the current page
 * context to filter + group commands, and returns three views:
 * contextual (page-scoped), global, and a flat `all` list.
 *
 * Used by `SidePanelCmdk` to render the command palette.
 */
export function useCommands(): ResolvedCommands {
  const registry = useAtomValue(readCommandRegistryAtom);
  const { pageId, matchesPrefix } = usePageContext();

  return useMemo(
    () => resolveCommands(registry, { pageId, matchesPrefix }),
    [registry, pageId, matchesPrefix],
  );
}

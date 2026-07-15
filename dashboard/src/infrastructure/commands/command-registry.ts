import { atom } from "jotai";
import type { Command, CommandRegistry } from "./command-types";

// ── Core registry atom ─────────────────────────────────────────────────────────

/**
 * Central command registry.
 *
 * Pages call `useRegisterCommands(pageId, commands)` to register.
 * The `SidePanelCmdk` reads from this atom via `useCommands()`.
 *
 * The `global` key holds commands available on every page.
 * Page-specific keys hold contextual commands.
 *
 * Exported for testing — prefer `readCommandRegistryAtom` for reads
 * and `registerCommandsAtom` / `unregisterCommandsAtom` for writes.
 */
export const commandRegistryAtom = atom<CommandRegistry>({ global: [] });

// ── Read atom ──────────────────────────────────────────────────────────────────

/** Read-only: the full command registry. */
export const readCommandRegistryAtom = atom((get) => get(commandRegistryAtom));

// ── Write atoms ────────────────────────────────────────────────────────────────

/**
 * Register commands for a page (or globally).
 *
 * Call once per page mount — previous commands for the same key are replaced.
 * When the component unmounts, commands are removed.
 */
export const registerCommandsAtom = atom(
  null,
  (get, set, payload: { key: "global" | string; commands: Command[] }) => {
    const current = { ...get(commandRegistryAtom) };
    current[payload.key] = payload.commands;
    set(commandRegistryAtom, current);
  },
);

/**
 * Unregister commands for a page (or globally).
 *
 * Called automatically when the registering component unmounts.
 */
export const unregisterCommandsAtom = atom(null, (get, set, key: string) => {
  const current = { ...get(commandRegistryAtom) };
  delete current[key];
  set(commandRegistryAtom, current);
});

import type { Icon } from "@tabler/icons-react";

// ── Page identity ──────────────────────────────────────────────────────────────

/**
 * Page identifiers — one per route that can have contextual commands.
 *
 * Mirrors the key structure in shared/navigation.ts for consistency.
 * When a new page is added, add its key here and register commands.
 */
export const PAGE_IDS = [
  "dashboard",
  "devices.list",
  "devices.new",
  "devices.detail",
  "attendance.list",
  "employees.list",
  "employees.detail",
  "employees.new",
  "reports",
  "settings.system",
  "settings.users",
  "settings.apiKeys",
  "settings.endpoints",
  "settings.audit",
] as const;

export type PageId = (typeof PAGE_IDS)[number];

// ── Command scope ──────────────────────────────────────────────────────────────

/** A command visible everywhere. */
export type GlobalScope = { type: "global" };

/** A command visible only on a specific page. */
export type PageScope = { type: "page"; pageId: PageId };

/** A command visible on multiple pages sharing a pattern (e.g. all device pages). */
export type PatternScope = { type: "pattern"; pattern: string };

export type CommandScope = GlobalScope | PageScope | PatternScope;

// ── Command ────────────────────────────────────────────────────────────────────

/**
 * A single command shown in the Cmd+K palette.
 *
 * Commands are registered by each page via `useRegisterCommands` and
 * resolved contextually by `useCommands`. The registry groups them:
 * contextual commands first, then global commands.
 */
export type Command = {
  /** Unique command id. Must be unique across the entire app. */
  id: string;
  /** Display label (i18n'd string). */
  label: string;
  /** Optional description shown below the label. */
  description?: string;
  /** Tabler icon component. */
  icon: Icon;
  /** Search keywords to match against (besides label/description). */
  keywords: string[];
  /** Controls where this command appears. */
  scope: CommandScope;
  /** Action executed when the user selects this command. */
  action: () => void;
};

// ── Registry shape ─────────────────────────────────────────────────────────────

/**
 * Commands indexed by scope key.
 *
 * "global" key holds commands visible everywhere.
 * Each page id key (from PAGE_IDS) holds commands scoped to that page.
 * String-keyed so the registry can be mutated by page-level hooks.
 */
export type CommandRegistry = Record<string, Command[]>;

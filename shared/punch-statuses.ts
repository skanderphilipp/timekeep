/**
 * Punch status codes — single source of truth for attendance punch types.
 *
 * These are **normalized domain values**, independent of any specific
 * device vendor or protocol. The `code` integers are our internal enum
 * discriminants (mirroring Rust `PunchStatus` discriminants), NOT
 * vendor protocol codes. Protocol mapping happens in the provider layer.
 *
 * Serialized as snake_case in API responses (serde `rename_all = "snake_case"`).
 *
 * Framework-agnostic: no React, no Lingui, no runtime imports.
 */

/** Canonical punch status value strings — use for type-safe unions. */
export type PunchStatusValue =
  | "check_in"
  | "check_out"
  | "break_out"
  | "break_in"
  | "overtime_in"
  | "overtime_out";

/** A punch status definition. */
export type PunchStatus = {
  /** Wire value (snake_case, matches Rust serde output). */
  value: PunchStatusValue;
  /** Human-readable label for badges and dropdowns. */
  label: string;
  /** Internal domain enum discriminant (not a vendor protocol code). */
  code: number;
  /** Category for grouping in filters. */
  category: "entry" | "exit" | "break" | "overtime";
};

/**
 * All punch statuses in canonical order.
 * Code values must match `PunchStatus` enum discriminants in Rust.
 */
export const PUNCH_STATUSES = [
  { value: "check_in",       label: "Check In",        code: 0, category: "entry" },
  { value: "check_out",      label: "Check Out",       code: 1, category: "exit" },
  { value: "break_out",      label: "Break Out",       code: 2, category: "break" },
  { value: "break_in",       label: "Break In",        code: 3, category: "break" },
  { value: "overtime_in",    label: "Overtime In",     code: 4, category: "overtime" },
  { value: "overtime_out",   label: "Overtime Out",    code: 5, category: "overtime" },
] as const satisfies readonly PunchStatus[];

/** Punch status value → definition lookup. */
export const PUNCH_STATUS_MAP = new Map<PunchStatusValue, PunchStatus>(
  PUNCH_STATUSES.map((s) => [s.value, s]),
);

/** Get the category of a punch status value. */
export function punchStatusCategory(value: string): PunchStatus["category"] | undefined {
  return PUNCH_STATUS_MAP.get(value as PunchStatusValue)?.category;
}

/** Check if a punch status represents an entry (check_in, break_in, overtime_in). */
export function isEntryStatus(value: string): boolean {
  return punchStatusCategory(value) === "entry";
}

/** Check if a punch status represents an exit (check_out, break_out, overtime_out). */
export function isExitStatus(value: string): boolean {
  return punchStatusCategory(value) === "exit";
}

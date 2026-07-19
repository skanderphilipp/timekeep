/**
 * timekeep — Date utility functions.
 *
 * Pure functions for date formatting and parsing. All functions operate
 * in local time — no UTC surprises, no timezone shifts.
 *
 * Import from: import { toDateString, fromDateString, formatDate } from "@/lib/date";
 */

// ── String ↔ Date conversion (local-time safe) ─────────────────────────────

/**
 * Convert a Date to YYYY-MM-DD using local time.
 *
 * @example toDateString(new Date(2026, 6, 10)) // "2026-07-10"
 */
export function toDateString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Parse YYYY-MM-DD as local midnight.
 *
 * @example fromDateString("2026-07-10") // Date(2026, 6, 10) in local time
 */
export function fromDateString(value: string): Date {
  const [y, m, d] = value.split("-").map(Number);
  return new Date(y, m - 1, d);
}

// ── Display formatting ─────────────────────────────────────────────────────

/**
 * Format a date for display in the date picker trigger button.
 *
 * Supports single-date and range modes.
 *
 * @example formatDisplay(new Date(2026, 6, 10), null, "single") // "2026-07-10"
 * @example formatDisplay(d1, d2, "range") // "2026-07-10 – 2026-07-15"
 */
export function formatDisplay(
  date: Date | null,
  endDate: Date | null | undefined,
  mode: "single" | "range",
  format: string = "yyyy-MM-dd",
): string {
  if (mode === "range" && date && endDate) {
    return `${formatSingle(date, format)} – ${formatSingle(endDate, format)}`;
  }
  if (date) return formatSingle(date, format);
  return "";
}

/** Format a single date with a pattern string. */
function formatSingle(date: Date, pattern: string): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return pattern.replace("yyyy", String(y)).replace("MM", m).replace("dd", d);
}

// ── Unix timestamp conversion (API boundary) ────────────────────────────────

/**
 * Convert a YYYY-MM-DD date string to a Unix timestamp at midnight UTC.
 *
 * @param iso — ISO date string (e.g., "2026-07-10"). Returns 0 for empty input.
 * @returns Unix timestamp in seconds.
 *
 * @example toUnixStartOfDay("2026-07-10") // 1752710400
 */
export function toUnixStartOfDay(iso: string): number {
  if (!iso) return 0;
  return Math.floor(new Date(`${iso}T00:00:00Z`).getTime() / 1000);
}

/**
 * Convert a YYYY-MM-DD date string to a Unix timestamp at end of day UTC.
 *
 * @param iso — ISO date string (e.g., "2026-07-10"). Returns 0 for empty input.
 * @returns Unix timestamp in seconds.
 *
 * @example toUnixEndOfDay("2026-07-10") // 1752796799
 */
export function toUnixEndOfDay(iso: string): number {
  if (!iso) return 0;
  return Math.floor(new Date(`${iso}T23:59:59Z`).getTime() / 1000);
}

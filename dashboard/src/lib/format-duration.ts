/**
 * Canonical duration formatting utilities.
 *
 * ALL duration ⇒ string formatting MUST go through this module.
 * No other module, component, or hook may contain its own seconds→hours,
 * hours→display, or minutes→display logic.
 *
 * Three input types, three functions:
 * - formatDurationSeconds — raw seconds from the API (most common)
 * - formatDurationHours   — already-computed hours (e.g., chart data)
 * - formatDurationMinutes — minutes from form inputs
 */

// ── Seconds → human-readable (API data) ─────────────────────────────────────

/**
 * Format raw seconds into a human-readable duration string.
 *
 * Examples:
 *   0        → "0h"
 *   1800     → "30m"
 *   3600     → "1.0h"
 *   30600    → "8.5h"
 *   28800    → "8.0h"
 *
 * @param seconds — raw seconds value from the API (can be 0 or negative)
 */
export function formatDurationSeconds(seconds: number): string {
  if (seconds <= 0) return "0h";
  const hours = seconds / 3600;
  if (hours < 1) return `${Math.round(seconds / 60)}m`;
  return `${hours.toFixed(1)}h`;
}

// ── Hours → display (chart/computed data) ───────────────────────────────────

/**
 * Format a pre-computed hours value for display.
 *
 * Examples:
 *   7.5  → "7.5h"
 *   0    → "0.0h"
 *   null → "—"
 *
 * @param hours — already-computed hours value (may be null)
 */
export function formatDurationHours(hours: number | null): string {
  if (hours == null) return "—";
  return `${hours.toFixed(1)}h`;
}

// ── Minutes → human-readable (form inputs) ──────────────────────────────────

/**
 * Format minutes into a human-readable hours+minutes string.
 *
 * Examples:
 *   0    → "0h"
 *   480  → "8h"
 *   510  → "8h 30m"
 *   45   → "0h 45m"
 *
 * @param minutes — total minutes
 */
export function formatDurationMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0 && m === 0) return "0h";
  if (m === 0) return `${h}h`;
  if (h === 0) return `${m}m`;
  return `${h}h ${m}m`;
}

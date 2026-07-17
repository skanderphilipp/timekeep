/**
 * Pure calendar utility functions — extracted from CalendarMonth for testability.
 *
 * These functions have zero React dependencies. They can be unit-tested
 * without any component rendering or DOM interaction.
 *
 * Types are defined here (not in calendar-month.tsx) to avoid circular imports.
 */

import type { Day } from "date-fns";
import {
  startOfMonth,
  startOfWeek,
  eachDayOfInterval,
  addDays,
  format,
  isSameDay,
  	isWeekend,
  getDate,
  getMonth,
} from "date-fns";

// Re-export for backward compatibility (wrapping date-fns internally)
export { isSameDay as sameDay, isWeekend } from "date-fns";

// ── Types ──────────────────────────────────────────────────────────────────────

/** Attendance status for a calendar day cell. */
export type CalendarDayStatus = "full" | "half" | "late" | "absent" | "weekend";

/** Data for a single day in the calendar. */
export type CalendarDayData = {
  /** ISO date string (YYYY-MM-DD). */
  date: string;
  /** Day of month number (1–31). */
  day: number;
  /** Whether this day belongs to the displayed month. */
  isCurrentMonth: boolean;
  /** Whether this day is the current date. */
  isToday: boolean;
  /** Attendance status — drives background color. */
  status: CalendarDayStatus;
  /** Hours worked, if any. Shown inside the cell. */
  hours?: number | null;
};

// ── Helpers ────────────────────────────────────────────────────────────────────

/** Format an ISO date string from a Date object. */
export function isoDate(year: number, month: number, day: number): string {
  return format(new Date(year, month - 1, day), "yyyy-MM-dd");
}

/**
 * Generate 42 calendar day cells (6 weeks × 7 days) covering the given month.
 *
 * Each cell resolves its status from the `dayStatus` map or falls back to defaults:
 * - Explicit data from dayStatus map
 * - Days from adjacent months → "weekend" (neutral/gray)
 * - Weekend days in current month → "weekend"
 * - Working days in current month with no data → "absent"
 */
export function generateDays(
  year: number,
  month: number,
  weekStartsOn: Day,
  dayStatus?: Record<string, { status: CalendarDayStatus; hours?: number | null }>,
): CalendarDayData[] {
  const today = new Date();
  const firstOfMonth = startOfMonth(new Date(year, month - 1, 1));
  const gridStart = startOfWeek(firstOfMonth, { weekStartsOn });
  const targetMonth = month - 1;

  const days: CalendarDayData[] = [];

  // Generate exactly 42 days (6 weeks × 7) using date-fns interval
  const dates = eachDayOfInterval({
    start: gridStart,
    end: addDays(gridStart, 41),
  });

  for (const date of dates) {
    const key = format(date, "yyyy-MM-dd");
    const inMonth = getMonth(date) === targetMonth;
    		const weekend = isWeekend(date);

    const data = dayStatus?.[key];
    let status: CalendarDayStatus;
    let hours: number | null | undefined;

    if (data) {
      status = data.status;
      hours = data.hours;
    } else if (!inMonth) {
      status = "weekend";
      hours = null;
    } else if (weekend) {
      status = "weekend";
      hours = null;
    } else {
      status = "absent";
      hours = null;
    }

    days.push({
      date: key,
      day: getDate(date),
      isCurrentMonth: inMonth,
      isToday: isSameDay(date, today),
      status,
      hours: hours ?? null,
    });
  }

  return days;
}

/** Format hours as a short string, e.g. 7.5 → "7.5h". */
export function formatHours(h: number): string {
  return `${h.toFixed(1)}h`;
}

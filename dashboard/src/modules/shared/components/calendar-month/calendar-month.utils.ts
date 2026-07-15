/**
 * Pure calendar utility functions — extracted from CalendarMonth for testability.
 *
 * These functions have zero React dependencies. They can be unit-tested
 * without any component rendering or DOM interaction.
 *
 * Types are defined here (not in calendar-month.tsx) to avoid circular imports.
 */

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

/** Format an ISO date string from numeric year, month, day. */
export function isoDate(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** Check if a date falls on a weekend (Saturday or Sunday). */
export function isWeekend(date: Date): boolean {
  const d = date.getDay();
  return d === 0 || d === 6;
}

/** Check if two dates represent the same calendar day. */
export function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
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
  weekStartsOn: number,
  dayStatus?: Record<string, { status: CalendarDayStatus; hours?: number | null }>,
): CalendarDayData[] {
  const today = new Date();
  const firstOfMonth = new Date(year, month - 1, 1);
  const startDayOfWeek = firstOfMonth.getDay();
  const offset = (startDayOfWeek - weekStartsOn + 7) % 7;
  const gridStart = new Date(year, month - 1, 1 - offset);

  const days: CalendarDayData[] = [];

  for (let i = 0; i < 42; i++) {
    const date = new Date(gridStart);
    date.setDate(gridStart.getDate() + i);
    const key = isoDate(date.getFullYear(), date.getMonth() + 1, date.getDate());
    const inMonth = date.getMonth() === month - 1;
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
      day: date.getDate(),
      isCurrentMonth: inMonth,
      isToday: sameDay(date, today),
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

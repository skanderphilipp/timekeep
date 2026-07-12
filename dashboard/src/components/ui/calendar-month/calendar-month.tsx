import { type ReactNode, useMemo, useCallback } from "react";
import { clsx } from "clsx";
import { useLingui } from "@lingui/react";
import { msg } from "@lingui/core/macro";

import { Spinner } from "../spinner";
import { EmptyState } from "../empty-state";

import styles from "./calendar-month.module.scss";

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

export type CalendarMonthProps = {
  /** Calendar year. */
  year: number;
  /** Calendar month (1–12). */
  month: number;
  /**
   * Status data keyed by ISO date string (YYYY-MM-DD).
   * Days not present in this map default to "weekend" for Sat/Sun
   * or "absent" for working days in the current month.
   */
  dayStatus?: Record<string, { status: CalendarDayStatus; hours?: number | null }>;
  /** Day the week starts on: 0 = Sunday, 1 = Monday. */
  weekStartsOn?: 0 | 1;
  /** Called when a day cell is clicked. */
  onDayClick?: (day: CalendarDayData) => void;
  /** Currently selected date (ISO string). Renders with selection ring. */
  selectedDate?: string;
  /** Custom weekday labels (length 7). Defaults to short locale names. */
  weekdayLabels?: string[];
  /** Loading state. */
  isLoading?: boolean;
  /** Error state. */
  error?: Error | null;
  /** Empty state when month has no data. */
  isEmpty?: boolean;
  /** Footer content (e.g., legend). */
  footer?: ReactNode;
  className?: string;
};

// ── Status → color mapping ─────────────────────────────────────────────────────

/** Maps day status to SCSS module class for background color. */
const STATUS_STYLE: Record<CalendarDayStatus, string> = {
  full: styles.statusFull,
  half: styles.statusHalf,
  late: styles.statusLate,
  absent: styles.statusAbsent,
  weekend: styles.statusWeekend,
};

// ── Helpers ────────────────────────────────────────────────────────────────────

function isoDate(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function isWeekend(date: Date): boolean {
  const d = date.getDay();
  return d === 0 || d === 6;
}

function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

/**
 * Generate 42 calendar day cells (6 weeks × 7 days) covering the given month.
 * Each cell resolves its status from the `dayStatus` map or falls back to defaults.
 */
function generateDays(
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

    // Resolve status: explicit data > weekend > absent (for working days in month) > other-month
    const data = dayStatus?.[key];
    let status: CalendarDayStatus;
    let hours: number | null | undefined;

    if (data) {
      status = data.status;
      hours = data.hours;
    } else if (!inMonth) {
      // Days from adjacent months: treat as neutral/gray
      status = "weekend";
      hours = null;
    } else if (weekend) {
      status = "weekend";
      hours = null;
    } else {
      // Working day in current month with no data → absent
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

// ── Sub-components ─────────────────────────────────────────────────────────────

function HeaderDay({ label }: { label: string }) {
  return (
    <div className={styles.headerDay} role="columnheader" aria-label={label}>
      {label}
    </div>
  );
}

function DayCell({
  day,
  isSelected,
  onClick,
}: {
  day: CalendarDayData;
  isSelected: boolean;
  onClick?: (day: CalendarDayData) => void;
}) {
  const handleClick = useCallback(() => onClick?.(day), [onClick, day]);
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if ((e.key === "Enter" || e.key === " ") && onClick) {
        e.preventDefault();
        onClick(day);
      }
    },
    [onClick, day],
  );

  const statusClass = STATUS_STYLE[day.status] ?? styles.statusWeekend;

  return (
    <div
      data-slot="calendar-day"
      data-date={day.date}
      data-status={day.status}
      data-today={day.isToday ? "" : undefined}
      data-selected={isSelected ? "" : undefined}
      data-other-month={!day.isCurrentMonth ? "" : undefined}
      className={clsx(
        styles.dayCell,
        statusClass,
        !day.isCurrentMonth && styles.otherMonth,
        isSelected && styles.selected,
      )}
      onClick={handleClick}
      onKeyDown={onClick ? handleKeyDown : undefined}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      aria-label={`${day.date} — ${day.status}${day.hours != null ? `, ${day.hours}h` : ""}`}
      aria-selected={isSelected || undefined}
    >
      <span className={clsx(styles.dayNumber, day.isToday && styles.today)}>{day.day}</span>
      {day.hours != null && <span className={styles.hours}>{formatHours(day.hours)}</span>}
    </div>
  );
}

function formatHours(h: number): string {
  return `${h.toFixed(1)}h`;
}

// ── Main Component ─────────────────────────────────────────────────────────────

export function CalendarMonth({
  year,
  month,
  dayStatus,
  weekStartsOn = 1,
  onDayClick,
  selectedDate,
  weekdayLabels,
  isLoading = false,
  error,
  isEmpty = false,
  footer,
  className,
}: CalendarMonthProps) {
  const { _ } = useLingui();

  const days = useMemo(
    () => generateDays(year, month, weekStartsOn, dayStatus),
    [year, month, weekStartsOn, dayStatus],
  );

  const weeks: CalendarDayData[][] = useMemo(() => {
    const w: CalendarDayData[][] = [];
    for (let i = 0; i < 6; i++) {
      w.push(days.slice(i * 7, i * 7 + 7));
    }
    return w;
  }, [days]);

  const labels = useMemo(() => {
    const base =
      weekdayLabels ??
      ([_(msg`Mon`), _(msg`Tue`), _(msg`Wed`), _(msg`Thu`), _(msg`Fri`), _(msg`Sat`), _(msg`Sun`)] as string[]);
    // If week starts on Monday (1), base is already Mon–Sun; if Sunday (0), reorder
    if (weekStartsOn === 0) {
      return [_(msg`Sun`), ...base.slice(0, 6)];
    }
    return base;
  }, [weekdayLabels, weekStartsOn, _]);

  // ── States ──────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div data-slot="calendar-month" className={clsx(styles.container, className)}>
        <div className={styles.stateOverlay}>
          <Spinner size="md" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div data-slot="calendar-month" className={clsx(styles.container, className)}>
        <EmptyState
          title={_(msg`Failed to load calendar`)}
          description={error.message}
        />
      </div>
    );
  }

  if (isEmpty) {
    return (
      <div data-slot="calendar-month" className={clsx(styles.container, className)}>
        <EmptyState
          title={_(msg`No attendance data`)}
          description={_(msg`No attendance data for this month`)}
        />
      </div>
    );
  }

  // ── Normal render ───────────────────────────────────────────────────────

  return (
    <div data-slot="calendar-month" className={clsx(styles.container, className)}>
      {/* Header row: weekday labels */}
      <div data-slot="calendar-header" className={styles.header} role="row">
        {labels.map((label) => (
          <HeaderDay key={label} label={label} />
        ))}
      </div>

      {/* Body: 6-week grid */}
      <div
        data-slot="calendar-body"
        className={styles.body}
        role="grid"
        aria-label={_(msg`Attendance calendar for ${0} ${0}`)}
      >
        {weeks.map((week, wi) => (
          <div key={`week-${wi}`} data-slot="calendar-week" className={styles.week} role="row">
            {week.map((day) => (
              <DayCell
                key={day.date}
                day={day}
                isSelected={selectedDate === day.date}
                onClick={onDayClick}
              />
            ))}
          </div>
        ))}
      </div>

      {footer && <div data-slot="calendar-footer" className={styles.footer}>{footer}</div>}
    </div>
  );
}

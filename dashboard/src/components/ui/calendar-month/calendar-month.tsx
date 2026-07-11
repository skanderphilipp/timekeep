import { type ReactNode, useMemo } from "react";
import { clsx } from "clsx";
import { useLingui } from "@lingui/react";
import { msg } from "@lingui/core/macro";

import styles from "./calendar-month.module.scss";

// ── Types ──────────────────────────────────────────────────────────────────────

export type CalendarDay = {
  /** The JavaScript Date for this day cell. */
  date: Date;
  /** ISO date string (YYYY-MM-DD) for stable keys. */
  key: string;
  /** Day of month number (1–31). */
  day: number;
  /** Whether this day is the current date. */
  isToday: boolean;
  /** Whether this day belongs to the displayed month. */
  isCurrentMonth: boolean;
  /** Whether this day is Saturday or Sunday. */
  isWeekend: boolean;
};

export type CalendarMonthProps = {
  /** Calendar year. */
  year: number;
  /** Calendar month (1–12). */
  month: number;
  /** Day the week starts on: 0 = Sunday, 1 = Monday, …, 6 = Saturday. */
  weekStartsOn?: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  /** Render function for the content area of each day cell. */
  renderDay?: (day: CalendarDay) => ReactNode;
  /** Called when a day cell is clicked. */
  onDayClick?: (day: CalendarDay) => void;
  /** Custom weekday labels (length 7). Defaults to short locale names. */
  weekdayLabels?: string[];
  className?: string;
};

// ── Helpers ────────────────────────────────────────────────────────────────────

function isoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/** Generate 42 calendar day cells (6 weeks × 7 days) covering the given month. */
function generateDays(
  year: number,
  month: number, // 1-based
  weekStartsOn: number,
): CalendarDay[] {
  const today = new Date();

  // First day of the displayed month
  const firstOfMonth = new Date(year, month - 1, 1);
  // Find the start of the calendar grid: go back to the start of the week
  const startDayOfWeek = firstOfMonth.getDay();
  const offset = (startDayOfWeek - weekStartsOn + 7) % 7;
  const gridStart = new Date(year, month - 1, 1 - offset);

  const days: CalendarDay[] = [];
  for (let i = 0; i < 42; i++) {
    const date = new Date(gridStart);
    date.setDate(gridStart.getDate() + i);

    days.push({
      date,
      key: isoDate(date),
      day: date.getDate(),
      isToday: sameDay(date, today),
      isCurrentMonth: date.getMonth() === month - 1,
      isWeekend: date.getDay() === 0 || date.getDay() === 6,
    });
  }

  return days;
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function CalendarHeaderDay({ label }: { label: string }) {
  return <div className={styles.headerDay}>{label}</div>;
}

function CalendarBodyDay({
  day,
  children,
  onClick,
}: {
  day: CalendarDay;
  children?: ReactNode;
  onClick?: (day: CalendarDay) => void;
}) {
  return (
    <div
      data-slot="calendar-day"
      data-today={day.isToday ? "" : undefined}
      data-other-month={!day.isCurrentMonth ? "" : undefined}
      data-weekend={day.isWeekend ? "" : undefined}
      className={clsx(
        styles.bodyDay,
        !day.isCurrentMonth && styles.otherMonth,
        day.isWeekend && styles.weekend,
      )}
      onClick={() => onClick?.(day)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick?.(day);
        }
      }}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      <div className={styles.dayHeader}>
        <span className={clsx(styles.dayNumber, day.isToday && styles.today)}>{day.day}</span>
      </div>
      <div className={styles.dayContent}>{children}</div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────

export function CalendarMonth({
  year,
  month,
  weekStartsOn = 1,
  renderDay,
  onDayClick,
  weekdayLabels,
  className,
}: CalendarMonthProps) {
  const { _ } = useLingui();
  const days = useMemo(() => generateDays(year, month, weekStartsOn), [year, month, weekStartsOn]);

  // Split 42 days into 6 weeks
  const weeks: CalendarDay[][] = [];
  for (let i = 0; i < 6; i++) {
    weeks.push(days.slice(i * 7, i * 7 + 7));
  }

  // Reorder labels to match weekStartsOn
  const labels = useMemo(() => {
    const base = weekdayLabels ?? [
      _(msg`Sun`),
      _(msg`Mon`),
      _(msg`Tue`),
      _(msg`Wed`),
      _(msg`Thu`),
      _(msg`Fri`),
      _(msg`Sat`),
    ];
    return [...base.slice(weekStartsOn), ...base.slice(0, weekStartsOn)];
  }, [weekdayLabels, weekStartsOn, _]);

  return (
    <div data-slot="calendar-month" className={clsx(styles.container, className)}>
      {/* Header: weekday labels */}
      <div data-slot="calendar-header" className={styles.header}>
        {labels.map((label) => (
          <CalendarHeaderDay key={label} label={label} />
        ))}
      </div>

      {/* Body: 6 weeks */}
      <div data-slot="calendar-body" className={styles.body}>
        {weeks.map((week, wi) => (
          <div key={`week-${wi}`} data-slot="calendar-week" className={styles.week}>
            {week.map((day) => (
              <CalendarBodyDay key={day.key} day={day} onClick={onDayClick}>
                {renderDay?.(day)}
              </CalendarBodyDay>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

import { useLingui } from "@lingui/react";
import { msg } from "@lingui/core/macro";
import { IconChevronLeft, IconChevronRight } from "@tabler/icons-react";

import { CalendarMonth } from "@/modules/shared/components";
import { useAttendanceCalendar } from "@/modules/attendance";
import { Button, IconButton, ActionGroup, Separator } from "@/components/ui";

import styles from "./employee-attendance-calendar.module.scss";

// ── Types ──────────────────────────────────────────────────────────────────────

export type EmployeeAttendanceCalendarProps = {
  /** The employee PIN to show attendance for. */
  pin: string;
};

// ── Component ──────────────────────────────────────────────────────────────────

/**
 * Self-contained calendar for a single employee.
 *
 * Uses {@link useAttendanceCalendar} in uncontrolled mode with `userPins={[pin]}`.
 * Designed for the employee detail side panel — includes its own month navigation.
 */
export function EmployeeAttendanceCalendar({ pin }: EmployeeAttendanceCalendarProps) {
  const { _ } = useLingui();
  const cal = useAttendanceCalendar({ userPins: [pin] });

  return (
    <div data-slot="employee-attendance-calendar" className={styles.root}>
      <Separator />

      <div className={styles.header}>
        <span className={styles.title}>{_(msg`Attendance`)}</span>
        <ActionGroup>
          <IconButton onClick={cal.goPrev} aria-label={_(msg`Previous month`)} size="sm">
            <IconChevronLeft size={14} />
          </IconButton>
          <Button variant="ghost" size="sm" onClick={cal.goToday}>
            {cal.monthLabel}
          </Button>
          <IconButton onClick={cal.goNext} aria-label={_(msg`Next month`)} size="sm">
            <IconChevronRight size={14} />
          </IconButton>
        </ActionGroup>
      </div>

      <CalendarMonth
        year={cal.year}
        month={cal.month}
        dayStatus={cal.dayStatusMap}
        weekStartsOn={1}
      />
    </div>
  );
}

EmployeeAttendanceCalendar.displayName = "EmployeeAttendanceCalendar";

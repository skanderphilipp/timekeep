import { useCallback, type ReactNode } from "react";
import { useSetAtom } from "jotai";
import { IconChevronLeft, IconChevronRight } from "@tabler/icons-react";
import { msg } from "@lingui/core/macro";
import { useLingui } from "@lingui/react";
import type { MessageDescriptor } from "@lingui/core";

import { openSidePanelAtom } from "@/infrastructure/state";
import {
  CalendarMonth,
  Dot,
  Select,
  IconButton,
  Button,
  Text,
  ActionGroup,
  StatusDot,
  type CalendarDay,
} from "@/components/ui";
import { useAttendanceCalendar, statusLabel } from "./use-attendance-calendar";
import { DayDetailPanel } from "./day-detail-panel";

import styles from "./attendance-calendar.module.scss";

// ── Constants ──────────────────────────────────────────────────────────────────

type PunchStatus =
  | "check_in"
  | "check_out"
  | "break_out"
  | "break_in"
  | "overtime_in"
  | "overtime_out"
  | "absent"
  | "day_off";

const TIMEKEEP_COLORS: Record<string, string> = {
  check_in: styles.dotPresent,
  check_out: styles.dotPresent,
  break_in: styles.dotPresent,
  break_out: styles.dotWarning,
  overtime_in: styles.dotOvertime,
  overtime_out: styles.dotOvertime,
  absent: styles.dotAbsent,
  day_off: styles.dotDayOff,
};

function classifyDay(punches: { status: string }[]): PunchStatus {
  if (punches.length === 0) return "absent";
  const statuses = new Set(punches.map((p) => p.status));
  if (statuses.has("check_in") || statuses.has("check_out")) return "check_in";
  if (statuses.has("break_out") || statuses.has("break_in")) return "break_out";
  if (statuses.has("overtime_in") || statuses.has("overtime_out")) return "overtime_in";
  return "check_in";
}

// ── Calendar Dot ───────────────────────────────────────────────────────────────

/**
 * Colored 8px indicator dot inside a calendar cell.
 * Shows attendance status (present/break/overtime/absent/day-off) for the day.
 */
function CalendarDot({
  status,
  _,
}: {
  status: PunchStatus;
  _: (desc: MessageDescriptor) => string;
}) {
  return <Dot color={TIMEKEEP_COLORS[status]} title={statusLabel(status, _)} size="sm" />;
}

// ── Legend ─────────────────────────────────────────────────────────────────────

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <ActionGroup>
      <StatusDot status="online" className={color} />
      <Text variant="caption" color="secondary">
        {label}
      </Text>
    </ActionGroup>
  );
}

// ── Component ──────────────────────────────────────────────────────────────────

export function AttendanceCalendarPage() {
  const { _ } = useLingui();
  const openSidePanel = useSetAtom(openSidePanelAtom);
  const cal = useAttendanceCalendar();

  const handleDayClick = useCallback(
    (day: CalendarDay) => {
      const key = `${day.date.getFullYear()}-${String(day.date.getMonth() + 1).padStart(2, "0")}-${String(day.date.getDate()).padStart(2, "0")}`;
      const punches = cal.punchesByDay.get(key) ?? [];
      openSidePanel({
        title: day.date.toLocaleDateString(undefined, {
          weekday: "long",
          month: "long",
          day: "numeric",
        }),
        render: () => <DayDetailPanel day={day} punches={punches} />,
      });
    },
    [cal.punchesByDay, openSidePanel],
  );

  const renderDay = useCallback(
    (day: CalendarDay): ReactNode => {
      const key = `${day.date.getFullYear()}-${String(day.date.getMonth() + 1).padStart(2, "0")}-${String(day.date.getDate()).padStart(2, "0")}`;
      const dayPunches = cal.punchesByDay.get(key);
      if (!dayPunches || dayPunches.length === 0) return null;

      const status = classifyDay(dayPunches);
      const count = dayPunches.length > 1 ? dayPunches.length : "";

      return (
        <>
          <CalendarDot status={status} _={_} />
          {count && <Text variant="caption">{String(count)}</Text>}
        </>
      );
    },
    [cal.punchesByDay, _],
  );

  return (
    <section data-slot="attendance-calendar" className={styles.root}>
      <nav data-slot="calendar-toolbar" className={styles.toolbar}>
        <ActionGroup>
          <IconButton onClick={cal.goPrev} aria-label={_(msg`Previous month`)} size="sm">
            <IconChevronLeft />
          </IconButton>
          <Button variant="ghost" onClick={cal.goToday}>
            {cal.monthLabel}
          </Button>
          <IconButton onClick={cal.goNext} aria-label={_(msg`Next month`)} size="sm">
            <IconChevronRight />
          </IconButton>
        </ActionGroup>

        <Select
          value={cal.selectedEmployee}
          onChange={(value) => cal.setSelectedEmployee(value)}
          options={cal.employeeOptions}
          placeholder={_(msg`All Employees`)}
          className={styles.employeeSelect}
        />

        <ActionGroup className={styles.legend}>
          <LegendItem color={styles.dotPresent} label={_(msg`Present`)} />
          <LegendItem color={styles.dotWarning} label={_(msg`Break`)} />
          <LegendItem color={styles.dotOvertime} label={_(msg`Overtime`)} />
          <LegendItem color={styles.dotAbsent} label={_(msg`Absent`)} />
          <LegendItem color={styles.dotDayOff} label={_(msg`Day Off`)} />
        </ActionGroup>
      </nav>

      <CalendarMonth
        year={cal.year}
        month={cal.month}
        weekStartsOn={1}
        renderDay={renderDay}
        onDayClick={handleDayClick}
        className={styles.calendar}
      />
    </section>
  );
}

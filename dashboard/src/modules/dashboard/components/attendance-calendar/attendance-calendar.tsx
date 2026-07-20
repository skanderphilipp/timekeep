import { useCallback } from "react";
import { useSetAtom } from "jotai";
import { IconChevronLeft, IconChevronRight } from "@tabler/icons-react";
import { msg } from "@lingui/core/macro";
import { useLingui } from "@lingui/react";

import { openSidePanelAtom } from "@/infrastructure/state";
import { Select, IconButton, Button, Text, ActionGroup, StatusDot } from "@/components/ui";
import { CalendarMonth, type CalendarDayData } from "@/modules/shared/components";
import { useAttendanceCalendar, MiniStatusBars, DayDetailPanel } from "@/modules/attendance";
import type { CalendarEmployeeDay } from "@/lib/api/attendance";

import styles from "./attendance-calendar.module.scss";

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
    (day: CalendarDayData) => {
      const entries = cal.employeeStatusesByDay.get(day.date) ?? [];
      // Convert EmployeeStatusEntry[] → CalendarEmployeeDay[] for the detail panel
      const employees: CalendarEmployeeDay[] = entries.map((e) => ({
        pin: e.pin,
        name: e.name,
        status: e.status,
        hours: e.hours ?? 0,
        overtime_hours: 0,
        break_minutes: 0,
        anomaly_count: 0,
        is_late: e.status === "late",
      }));
      openSidePanel({
        title: day.date,
        render: () => (
          <DayDetailPanel day={day} employees={employees} />
        ),
      });
    },
    [cal.employeeStatusesByDay, openSidePanel],
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
        dayStatus={cal.dayStatusMap}
        isLoading={cal.isLoading}
        onDayClick={handleDayClick}
        renderDayContent={
          !cal.selectedEmployee
            ? (day) => {
              const statuses = cal.employeeStatusesByDay.get(day.date);
              return statuses && statuses.length > 0 ? (
                <MiniStatusBars statuses={statuses} />
              ) : null;
            }
            : undefined
        }
        className={styles.calendar}
      />
    </section>
  );
}

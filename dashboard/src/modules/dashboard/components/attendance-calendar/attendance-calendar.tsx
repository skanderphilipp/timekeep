import { useCallback } from "react";
import { useSetAtom } from "jotai";
import { IconChevronLeft, IconChevronRight } from "@tabler/icons-react";
import { msg } from "@lingui/core/macro";
import { useLingui } from "@lingui/react";

import { openSidePanelAtom } from "@/infrastructure/state";
import { Select, IconButton, Button, Text, ActionGroup, StatusDot } from "@/components/ui";
import { CalendarMonth, type CalendarDayData } from "@/modules/shared/components";
import { useAttendanceCalendar } from "./use-attendance-calendar";
import { DayDetailPanel } from "./day-detail-panel";

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
      const punches = cal.punchesByDay.get(day.date) ?? [];
      const [y, m, d] = day.date.split("-").map(Number);
      const date = new Date(y!, m! - 1, d!);
      openSidePanel({
        title: date.toLocaleDateString(undefined, {
          weekday: "long",
          month: "long",
          day: "numeric",
        }),
        render: () => <DayDetailPanel day={day} punches={punches} />,
      });
    },
    [cal.punchesByDay, openSidePanel],
  );

  // Build the dayStatus map from punchesByDay for CalendarMonth's data-driven API.
  // CalendarMonth handles background color + hours display natively.
  const dayStatus = cal.dayStatusMap;

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
        dayStatus={dayStatus}
        onDayClick={handleDayClick}
        className={styles.calendar}
      />
    </section>
  );
}

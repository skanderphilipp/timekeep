import { useLingui } from "@lingui/react";
import { msg } from "@lingui/core/macro";

// oxlint-disable-next-line bentech/require-data-list-view -- detail sub-table for a single employee's daily attendance log, not a list page
import { DataTable, TextCell, Badge, Text } from "@/components/ui";
import type { DataTableColumn } from "@/components/ui";
import type { EmployeeWorkDays, WorkDay } from "@/lib/api";

type EmployeeAttendanceLogProps = {
  workDays: EmployeeWorkDays;
};

/** Format seconds as Hh Mmm. */
function formatDuration(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  if (hours === 0) return `${minutes}m`;
  return `${hours}h ${minutes}m`;
}

/** Format a Unix timestamp as HH:MM or "—". */
function formatTime(ts: number | null | undefined): string {
  if (ts == null) return "—";
  return new Date(ts * 1000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

/** Get the first period's check-in timestamp, or null. */
function firstCheckIn(day: WorkDay): number | null {
  return day.periods[0]?.check_in ?? null;
}

/** Get the last period's check-out timestamp, or null. */
function lastCheckOut(day: WorkDay): number | null {
  const last = day.periods[day.periods.length - 1];
  return last?.check_out ?? null;
}

function useColumns() {
  const { _ } = useLingui();

  const columns: DataTableColumn<WorkDay>[] = [
    {
      id: "date",
      header: _(msg`Date`),
      cell: (day) => <TextCell text={new Date(day.date).toLocaleDateString()} />,
      width: "120px",
    },
    {
      id: "status",
      header: _(msg`Status`),
      cell: (day) => {
        if (day.anomaly_count > 0) return <Badge variant="warning" size="sm">{_(msg`Anomaly`)}</Badge>;
        if (day.status === "present") return <Badge variant="success" size="sm">{_(msg`Present`)}</Badge>;
        if (day.status === "absent") return <Badge variant="danger" size="sm">{_(msg`Absent`)}</Badge>;
        if (day.status === "late") return <Badge variant="warning" size="sm">{_(msg`Late`)}</Badge>;
        return <Badge variant="neutral" size="sm">{day.status}</Badge>;
      },
      width: "100px",
    },
    {
      id: "check_in",
      header: _(msg`Check In`),
      cell: (day) => <TextCell text={formatTime(firstCheckIn(day))} />,
      width: "100px",
    },
    {
      id: "check_out",
      header: _(msg`Check Out`),
      cell: (day) => <TextCell text={formatTime(lastCheckOut(day))} />,
      width: "100px",
    },
    {
      id: "hours",
      header: _(msg`Hours`),
      cell: (day) => <TextCell text={formatDuration(day.total_regular_seconds + day.total_overtime_seconds)} />,
      width: "90px",
    },
    {
      id: "overtime",
      header: _(msg`Overtime`),
      cell: (day) => (
        <TextCell text={day.total_overtime_seconds > 0 ? formatDuration(day.total_overtime_seconds) : "—"} />
      ),
      width: "90px",
    },
  ];

  return columns;
}

/**
 * Employee attendance log — daily punch table.
 *
 * Renders work days from {@link EmployeeWorkDays} in a sortable
 * data table with date, status badge, check-in/out, hours, and overtime.
 */
export function EmployeeAttendanceLog({ workDays }: EmployeeAttendanceLogProps) {
  const { _ } = useLingui();
  const columns = useColumns();

  if (workDays.work_days.length === 0) {
    return (
      <Text variant="body" color="tertiary" style={{ padding: "var(--ao-spacing-6)", textAlign: "center" }}>
        {_(msg`No attendance records found for this period.`)}
      </Text>
    );
  }

  return (
    <DataTable
      columns={columns}
      data={workDays.work_days}
      getRowKey={(day) => String(day.date)}
      rowDataSlot="attendance-log-row"
    />
  );
}

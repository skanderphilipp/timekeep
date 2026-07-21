import { useLingui } from "@lingui/react";
import { msg } from "@lingui/core/macro";

// oxlint-disable-next-line bentech/require-data-list-view -- KPI sub-table inside reports, not a standalone list page
import { Chart, DataTable, TextCell } from "@/components/ui";
import type { DataTableColumn } from "@/components/ui";
import type { EmployeeReportKpi } from "@/lib/api";
import { formatDurationSeconds } from "@/lib/format-duration";

/**
 * Employee KPI table — attendance performance per employee.
 *
 * Shows each employee's presence, absence, late days, average hours,
 * and overtime. Time values use formatDurationSeconds for consistency
 * with the summary cards (hours, not minutes).
 */
export function EmployeeKpiTable({ data }: { data: EmployeeReportKpi[] }) {
  const { _ } = useLingui();

  const columns: DataTableColumn<EmployeeReportKpi>[] = [
    {
      id: "name",
      header: _(msg`Employee`),
      cell: (row) => <TextCell text={row.employee_name ?? row.user_pin} />,
    },
    {
      id: "present",
      header: _(msg`Present`),
      cell: (row) => <TextCell text={String(row.days_present)} />,
      width: "80px",
    },
    {
      id: "absent",
      header: _(msg`Absent`),
      cell: (row) => <TextCell text={String(row.days_absent)} />,
      width: "80px",
    },
    {
      id: "late",
      header: _(msg`Late`),
      cell: (row) => <TextCell text={String(row.days_late)} />,
      width: "80px",
    },
    {
      id: "avg_hours",
      header: _(msg`Avg/Day`),
      cell: (row) => <TextCell text={formatDurationSeconds(row.avg_seconds_per_day)} />,
      width: "90px",
    },
    {
      id: "overtime",
      header: _(msg`OT`),
      cell: (row) =>
        row.overtime_seconds > 0 ? (
          <TextCell text={formatDurationSeconds(row.overtime_seconds)} />
        ) : (
          <TextCell text="—" />
        ),
      width: "90px",
    },
  ];

  if (data.length === 0) {
    return null;
  }

  return (
    <Chart
      title={_(msg`Employee Attendance`)}
      description={_(msg`Attendance KPIs per employee for the selected date range.`)}
    >
      <DataTable columns={columns} data={data} getRowKey={(row) => row.user_pin} stickyHeader rowDataSlot="employee-kpi-row" />
    </Chart>
  );
}

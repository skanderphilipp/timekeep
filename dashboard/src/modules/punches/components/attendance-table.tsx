import { useLingui } from "@lingui/react";
import { msg } from "@lingui/core/macro";

import {
  DataTable,
  TextCell,
  TimestampCell,
  StatusCell,
  Tag,
  type DataTableColumn,
  type SortState,
} from "@/components/ui";

// ── Types ────────────────────────────────────────────────────────────────────

export type PunchRecord = {
  id: string;
  employeeName: string;
  employeeId: string;
  deviceName: string;
  deviceSn: string;
  punchTime: string;
  direction: "in" | "out";
  status: "present" | "late" | "absent" | "overtime" | "early";
  verifyMode: string;
};

export type AttendanceTableProps = {
  data: PunchRecord[];
  isLoading?: boolean;
  sortState?: SortState | null;
  onSortChange?: (columnId: string) => void;
  onDeviceClick?: (deviceSn: string, deviceName: string) => void;
  onEmployeeClick?: (employeeId: string) => void;
  className?: string;
};

// ── Helpers ─────────────────────────────────────────────────────────────────

const STATUS_MAP: Record<
  PunchRecord["status"],
  { variant: "online" | "offline" | "warning"; label: string }
> = {
  present: { variant: "online", label: "Present" },
  late: { variant: "warning", label: "Late" },
  absent: { variant: "offline", label: "Absent" },
  overtime: { variant: "online", label: "Overtime" },
  early: { variant: "warning", label: "Early" },
};

// ── Component ───────────────────────────────────────────────────────────────

export function AttendanceTable({
  data,
  isLoading,
  sortState,
  onSortChange,
  onDeviceClick,
  onEmployeeClick,
  className,
}: AttendanceTableProps) {
  const { _ } = useLingui();

  const STATUS_LABEL: Record<PunchRecord["status"], string> = {
    present: _(msg`Present`),
    late: _(msg`Late`),
    absent: _(msg`Absent`),
    overtime: _(msg`Overtime`),
    early: _(msg`Early`),
  };

  const columns: DataTableColumn<PunchRecord>[] = [
    {
      id: "employeeName",
      header: _(msg`Employee`),
      width: "180px",
      sortable: true,
      cell: (row) => (
        <TextCell
          text={row.employeeName}
          clickable={!!onEmployeeClick}
          onClick={() => onEmployeeClick?.(row.employeeId)}
        />
      ),
    },
    {
      id: "punchTime",
      header: _(msg`Time`),
      width: "160px",
      sortable: true,
      cell: (row) => <TimestampCell value={row.punchTime} format="time" />,
    },
    {
      id: "direction",
      header: _(msg`Type`),
      width: "80px",
      sortable: true,
      cell: (row) => (
        <Tag
          text={row.direction === "in" ? _(msg`IN`) : _(msg`OUT`)}
          color={row.direction === "in" ? "green" : "blue"}
          variant="solid"
          weight="medium"
        />
      ),
    },
    {
      id: "status",
      header: _(msg`Status`),
      width: "120px",
      sortable: true,
      cell: (row) => {
        const s = STATUS_MAP[row.status];
        return <StatusCell status={s.variant} label={STATUS_LABEL[row.status]} />;
      },
    },
    {
      id: "deviceName",
      header: _(msg`Device`),
      width: "140px",
      sortable: true,
      cell: (row) => (
        <TextCell
          text={row.deviceName}
          clickable={!!onDeviceClick}
          onClick={() => onDeviceClick?.(row.deviceSn, row.deviceName)}
        />
      ),
    },
    {
      id: "verifyMode",
      header: _(msg`Verification`),
      width: "120px",
      cell: (row) => <TextCell text={row.verifyMode} />,
    },
  ];

  return (
    <DataTable
      className={className}
      columns={columns}
      data={data}
      getRowKey={(row) => row.id}
      isLoading={isLoading}
      sortState={sortState}
      onSortChange={onSortChange}
      stickyHeader
    />
  );
}

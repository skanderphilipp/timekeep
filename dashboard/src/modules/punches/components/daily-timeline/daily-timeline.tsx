import { useMemo } from "react";
import { useSetAtom } from "jotai";
import { msg } from "@lingui/core/macro";
import { useLingui } from "@lingui/react";
import type { MessageDescriptor } from "@lingui/core";

import { openSidePanelAtom } from "@/infrastructure/state";
import { usePunchData, type Punch } from "@/modules/punches/hooks/use-punch-data";
import { Timeline, type TimelineRowData, type TimelineBlockData } from "@/components/ui/timeline";
import { Text, Heading, ListItem } from "@/components/ui";

// ── Types ──────────────────────────────────────────────────────────────────────

export type TimelineEmployee = {
  pin: string;
  name: string;
};

export type DailyTimelineProps = {
  date: Date;
  employees?: TimelineEmployee[];
  className?: string;
};

// ── Helpers ────────────────────────────────────────────────────────────────────

const STATUS_CLASS: Record<string, TimelineBlockData["color"]> = {
  check_in: "present",
  check_out: "present",
  break_in: "warning",
  break_out: "warning",
  overtime_in: "overtime",
  overtime_out: "overtime",
};

function timeToMinutes(ts: number): number {
  const d = new Date(ts * 1000);
  return d.getHours() * 60 + d.getMinutes();
}

function statusLabel(status: string, _: (msg: MessageDescriptor) => string): string {
  const labels: Record<string, MessageDescriptor> = {
    check_in: msg`Check In`,
    check_out: msg`Check Out`,
    break_in: msg`Break In`,
    break_out: msg`Break Out`,
    overtime_in: msg`Overtime In`,
    overtime_out: msg`Overtime Out`,
  };
  return _(labels[status] ?? status);
}

function buildBlocks(
  punches: Punch[],
  _: (msg: MessageDescriptor) => string,
): TimelineBlockData[] {
  const sorted = [...punches].sort((a, b) => a.timestamp - b.timestamp);
  const blocks: TimelineBlockData[] = [];
  let inBlock: { startMinute: number; status: string } | null = null;

  for (const punch of sorted) {
    const minute = timeToMinutes(punch.timestamp);

    if (punch.status === "check_in" || punch.status === "break_in" || punch.status === "overtime_in") {
      if (inBlock) {
        blocks.push(createBlock(inBlock.startMinute, minute, inBlock.status, _));
      }
      inBlock = { startMinute: minute, status: punch.status };
    } else if (inBlock) {
      blocks.push(createBlock(inBlock.startMinute, minute, inBlock.status, _));
      inBlock = null;
    } else {
      blocks.push(createBlock(minute - 1, minute, punch.status, _));
    }
  }

  if (inBlock) {
    blocks.push(createBlock(inBlock.startMinute, Math.min(inBlock.startMinute + 30, 24 * 60), inBlock.status, _));
  }

  return blocks;
}

function createBlock(
  startMinute: number,
  endMinute: number,
  status: string,
  _: (msg: MessageDescriptor) => string,
): TimelineBlockData {
  const label = statusLabel(status, _);
  const startStr = `${String(Math.floor(startMinute / 60)).padStart(2, "0")}:${String(startMinute % 60).padStart(2, "0")}`;
  const endStr = `${String(Math.floor(endMinute / 60)).padStart(2, "0")}:${String(endMinute % 60).padStart(2, "0")}`;

  return {
    left: (startMinute / (24 * 60)) * 100,
    width: Math.max(((endMinute - startMinute) / (24 * 60)) * 100, 0.5),
    color: STATUS_CLASS[status] ?? "default",
    title: `${label}: ${startStr} - ${endStr}`,
  };
}

// ── Side Panel Content ─────────────────────────────────────────────────────────

function EmployeeDayDetail({
  employee,
  punches,
}: {
  employee: TimelineEmployee;
  punches: Punch[];
}) {
  const { _ } = useLingui();

  if (punches.length === 0) {
    return (
      <>
        <Heading level="h3">
          {employee.name} ({employee.pin})
        </Heading>
        <Text variant="body" color="tertiary">
          {_(msg`No records for this day.`)}
        </Text>
      </>
    );
  }

  return (
    <>
      <Heading level="h3">
        {employee.name} ({employee.pin})
      </Heading>
      {punches.map((p) => (
        <ListItem key={p.id}>
          <ListItem.Leading>
            <Text variant="body" weight="medium">
              {new Date(p.timestamp * 1000).toLocaleTimeString()}
            </Text>
            <Text variant="caption" color="secondary">
              {p.status}
            </Text>
          </ListItem.Leading>
          <ListItem.Trailing>
            <Text variant="caption" color="tertiary">
              {_(msg`Device: ${p.device_sn}`)}
            </Text>
          </ListItem.Trailing>
        </ListItem>
      ))}
    </>
  );
}

// ── Legend ─────────────────────────────────────────────────────────────────────

function buildLegendItems(_: (msg: MessageDescriptor) => string) {
  return [
    { color: "present" as const, label: _(msg`Present`) },
    { color: "warning" as const, label: _(msg`Break`) },
    { color: "overtime" as const, label: _(msg`Overtime`) },
  ];
}

// ── Component ──────────────────────────────────────────────────────────────────

export function DailyTimeline({
  date,
  employees,
  className,
}: DailyTimelineProps) {
  const { _ } = useLingui();
  const openSidePanel = useSetAtom(openSidePanelAtom);

  const since = useMemo(() => date.toISOString().split("T")[0], [date]);
  const until = useMemo(() => {
    const next = new Date(date);
    next.setDate(next.getDate() + 1);
    return next.toISOString().split("T")[0];
  }, [date]);

  const { data, isLoading } = usePunchData({
    since,
    until,
    limit: 5000,
  });

  const punchesByEmployee = useMemo(() => {
    const map = new Map<string, Punch[]>();
    data?.punches.forEach((p) => {
      const existing = map.get(p.user_pin) ?? [];
      existing.push(p);
      map.set(p.user_pin, existing);
    });
    return map;
  }, [data]);

  const employeeList: TimelineEmployee[] = useMemo(() => {
    if (employees && employees.length > 0) return employees;
    const seen = new Set<string>();
    const list: TimelineEmployee[] = [];
    data?.punches.forEach((p) => {
      if (!seen.has(p.user_pin)) {
        seen.add(p.user_pin);
        list.push({ pin: p.user_pin, name: p.employee_name ?? p.user_pin });
      }
    });
    return list;
  }, [data, employees]);

  const hourMarkers = useMemo(() => {
    const markers: string[] = [];
    for (let h = 0; h < 24; h++) {
      markers.push(`${String(h).padStart(2, "0")}:00`);
    }
    return markers;
  }, []);

  const rows: TimelineRowData[] = useMemo(
    () =>
      employeeList.map((emp) => {
        const punches = punchesByEmployee.get(emp.pin) ?? [];
        return {
          id: emp.pin,
          name: emp.name,
          subLabel: emp.pin,
          blocks: buildBlocks(punches, _),
          onClick: () => {
            openSidePanel({
              title: emp.name,
              render: () => <EmployeeDayDetail employee={emp} punches={punches} />,
            });
          },
        };
      }),
    [employeeList, punchesByEmployee, _, openSidePanel],
  );

  return (
    <Timeline
      headerLabel={_(msg`Employee`)}
      hourMarkers={hourMarkers}
      rows={rows}
      isLoading={isLoading}
      legendItems={buildLegendItems(_)}
      emptyState={_(msg`No punch records for this day.`)}
      className={className}
    />
  );
}

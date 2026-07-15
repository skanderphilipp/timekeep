import { useMemo } from "react";
import { useSetAtom } from "jotai";
import { msg } from "@lingui/core/macro";
import { useLingui } from "@lingui/react";

import { openSidePanelAtom } from "@/infrastructure/state";
import { usePunchData, type Punch } from "@/modules/punches/hooks/use-punch-data";
import { Text, Heading, ListItem } from "@/components/ui";
import { Timeline, type TimelineRowData } from "@/modules/shared/components";
import { buildBlocks, buildLegendItems } from "./daily-timeline-blocks";

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

// ── Component ──────────────────────────────────────────────────────────────────

export function DailyTimeline({ date, employees, className }: DailyTimelineProps) {
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

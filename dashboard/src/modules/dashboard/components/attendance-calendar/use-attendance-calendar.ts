import { useState, useMemo, useCallback } from "react";
import { useLingui } from "@lingui/react";
import { msg } from "@lingui/core/macro";
import type { MessageDescriptor } from "@lingui/core";

import { usePunchData, type Punch } from "@/modules/punches/hooks/use-punch-data";

// ── Types ──────────────────────────────────────────────────────────────────────

type EmployeeOption = {
  value: string;
  label: string;
};

// ── Helpers ────────────────────────────────────────────────────────────────────

function isoToDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function statusLabel(status: string, _: (msg: MessageDescriptor) => string): string {
  const labels: Record<string, MessageDescriptor> = {
    check_in: msg`Check In`,
    check_out: msg`Check Out`,
    break_in: msg`Break In`,
    break_out: msg`Break Out`,
    overtime_in: msg`Overtime In`,
    overtime_out: msg`Overtime Out`,
    absent: msg`Absent`,
    day_off: msg`Day Off`,
  };
  return _(labels[status] ?? status);
}

/**
 * Attendance calendar orchestration hook.
 *
 * Handles month navigation, employee filtering, punch data fetching,
 * grouping by day, and punch status classification. Extracted from the
 * AttendanceCalendarPage component to keep it under 250 lines.
 */
export function useAttendanceCalendar() {
  const { _ } = useLingui();
  const today = new Date();

  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [selectedEmployee, setSelectedEmployee] = useState<string>("");

  const since = useMemo(() => {
    const d = new Date(year, month - 1, 1);
    d.setDate(d.getDate() - 7);
    return d.toISOString().split("T")[0];
  }, [year, month]);

  const until = useMemo(() => {
    const d = new Date(year, month, 0);
    d.setDate(d.getDate() + 7);
    return d.toISOString().split("T")[0];
  }, [year, month]);

  const { data } = usePunchData({
    since,
    until,
    ...(selectedEmployee ? { user_pin: selectedEmployee } : {}),
    limit: 5000,
  });

  const punchesByDay = useMemo(() => {
    const map = new Map<string, Punch[]>();
    data?.punches.forEach((p) => {
      const d = new Date(p.timestamp * 1000);
      const key = isoToDateKey(d);
      const existing = map.get(key) ?? [];
      existing.push(p);
      map.set(key, existing);
    });
    return map;
  }, [data]);

  const employeeOptions: EmployeeOption[] = useMemo(() => {
    const seen = new Set<string>();
    const opts: EmployeeOption[] = [{ value: "", label: _(msg`All Employees`) }];
    data?.punches.forEach((p) => {
      const pin = p.user_pin;
      if (!seen.has(pin)) {
        seen.add(pin);
        opts.push({ value: pin, label: p.employee_name ?? pin });
      }
    });
    return opts;
  }, [data, _]);

  const goPrev = useCallback(() => {
    if (month === 1) {
      setYear((y) => y - 1);
      setMonth(12);
    } else {
      setMonth((m) => m - 1);
    }
  }, [month]);

  const goNext = useCallback(() => {
    if (month === 12) {
      setYear((y) => y + 1);
      setMonth(1);
    } else {
      setMonth((m) => m + 1);
    }
  }, [month]);

  const goToday = useCallback(() => {
    const now = new Date();
    setYear(now.getFullYear());
    setMonth(now.getMonth() + 1);
  }, []);

  const monthLabel = new Date(year, month - 1, 1).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
  });

  return {
    year,
    month,
    selectedEmployee,
    setSelectedEmployee,
    since,
    until,
    data,
    punchesByDay,
    employeeOptions,
    monthLabel,
    goPrev,
    goNext,
    goToday,
  };
}

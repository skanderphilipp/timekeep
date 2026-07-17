import { useState, useMemo, useCallback, useEffect } from "react";
import { useLingui } from "@lingui/react";
import { msg } from "@lingui/core/macro";

import { usePunchData, type Punch } from "@/modules/punches/hooks/use-punch-data";
import { classifyDayFromPunches, aggregateDayStatus, type CalendarDayStatus } from "../compute";

// ── Types ──────────────────────────────────────────────────────────────────────

export type EmployeeOption = {
  value: string;
  label: string;
};

export type UseAttendanceCalendarOptions = {
  /** External year control. When provided, overrides internal year state. */
  year?: number;
  /** External month control. When provided, overrides internal month state. */
  month?: number;
  /** Filter to a single employee PIN ("all" = no filter). */
  userPin?: string;
};

// ── Helpers ────────────────────────────────────────────────────────────────────

function isoToDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Attendance calendar orchestration hook.
 *
 * Handles month navigation, employee filtering, punch data fetching,
 * grouping by day, and day status classification for CalendarMonth.
 *
 * Supports two modes:
 * - **Controlled**: pass `year`/`month` options. Syncs externally (via useEffect).
 * - **Uncontrolled**: omit options. Internal state with prev/next/today navigation.
 */
export function useAttendanceCalendar(options: UseAttendanceCalendarOptions = {}) {
  const { _ } = useLingui();
  const today = new Date();

  // ── Year / Month ───────────────────────────────────────────────────────────
  const isControlled = options.year != null && options.month != null;
  const initialYear = options.year ?? today.getFullYear();
  const initialMonth = options.month ?? today.getMonth() + 1;

  const [year, setYear] = useState(initialYear);
  const [month, setMonth] = useState(initialMonth);

  const [selectedEmployee, setSelectedEmployee] = useState<string>("");

  // Sync when external year/month change (controlled mode)
  useEffect(() => {
    if (isControlled) {
      setYear(options.year!);
      setMonth(options.month!);
    }
  }, [isControlled, options.year, options.month]);

  const userPin = options.userPin || (selectedEmployee || undefined);

  // ── Data fetching ──────────────────────────────────────────────────────────
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
    ...(userPin ? { user_pin: userPin } : {}),
    limit: 10000,
  });

  // ── Day grouping ───────────────────────────────────────────────────────────
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

  /** CalendarMonth data map: ISO date → { status, hours }. */
  const dayStatusMap = useMemo(() => {
    const map: Record<string, { status: CalendarDayStatus; hours: number | null }> = {};
    punchesByDay.forEach((punches, key) => {
      if (userPin) {
        // Single employee: classify individually
        const { status, hours } = classifyDayFromPunches(punches);
        map[key] = { status, hours };
      } else {
        // All employees: aggregate
        const agg = aggregateDayStatus(punches);
        map[key] = { status: agg.status, hours: agg.avgHours };
      }
    });
    return map;
  }, [punchesByDay, userPin]);

  // ── Employee options ───────────────────────────────────────────────────────
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

  // ── Navigation (uncontrolled mode only) ────────────────────────────────────
  const goPrev = useCallback(() => {
    if (isControlled) return;
    if (month === 1) {
      setYear((y) => y - 1);
      setMonth(12);
    } else {
      setMonth((m) => m - 1);
    }
  }, [month, isControlled]);

  const goNext = useCallback(() => {
    if (isControlled) return;
    if (month === 12) {
      setYear((y) => y + 1);
      setMonth(1);
    } else {
      setMonth((m) => m + 1);
    }
  }, [month, isControlled]);

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
    dayStatusMap,
    employeeOptions,
    monthLabel,
    goPrev,
    goNext,
    goToday,
  };
}

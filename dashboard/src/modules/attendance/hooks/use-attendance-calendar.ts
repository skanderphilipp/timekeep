import { useState, useMemo } from "react";
import { useLingui } from "@lingui/react";
import { msg } from "@lingui/core/macro";

import { usePunchData, type Punch } from "@/modules/punches/hooks/use-punch-data";
import { classifyDayFromPunches, aggregateDayStatus, type CalendarDayStatus } from "../compute";
import { useCalendarNavigation } from "./use-calendar-navigation";
import type { EmployeeStatusEntry } from "../components/mini-status-bars";

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
	/** @deprecated Use `userPin` instead. Kept for backward compat. */
	userPins?: string[];
};

// ── Helpers ────────────────────────────────────────────────────────────────────

function isoToDateKey(date: Date): string {
	const y = date.getFullYear();
	const m = String(date.getMonth() + 1).padStart(2, "0");
	const d = String(date.getDate()).padStart(2, "0");
	return `${y}-${m}-${d}`;
}

// ── Hook ───────────────────────────────────────────────────────────────────────

/**
 * Attendance calendar orchestration hook.
 *
 * Composes {@link useCalendarNavigation} with punch data fetching,
 * day grouping, and status classification for CalendarMonth.
 *
 * Supports two modes:
 * - **Controlled**: pass `year`/`month` options
 * - **Uncontrolled**: internal navigation via prev/next/today
 */
export function useAttendanceCalendar(options: UseAttendanceCalendarOptions = {}) {
	const { _ } = useLingui();

	// ── Navigation ───────────────────────────────────────────────────────────
	const { year, month, monthLabel, goPrev, goNext, goToday, goPrevYear, goNextYear } = useCalendarNavigation({
		year: options.year,
		month: options.month,
	});

	// Backward compat: userPins (array) → first element
	const userPin = options.userPin ?? options.userPins?.[0] ?? undefined;

	// ── Employee filter state ────────────────────────────────────────────────
	const [selectedEmployee, setSelectedEmployee] = useState<string>("");
	const effectivePin = userPin || (selectedEmployee || undefined);

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
		...(effectivePin ? { user_pin: effectivePin } : {}),
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
			if (effectivePin) {
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
	}, [punchesByDay, effectivePin]);

	// ── Per-employee statuses (for mini status bars in All Employees mode) ──
	const employeeStatusesByDay = useMemo(() => {
		const map = new Map<string, EmployeeStatusEntry[]>();
		if (!effectivePin) {
			punchesByDay.forEach((punches, key) => {
				// Group punches within this day by employee PIN
				const byEmployee = new Map<string, Punch[]>();
				punches.forEach((p) => {
					const existing = byEmployee.get(p.user_pin) ?? [];
					existing.push(p);
					byEmployee.set(p.user_pin, existing);
				});
				// Classify each employee
				const entries: EmployeeStatusEntry[] = [];
				byEmployee.forEach((empPunches, pin) => {
					const { status } = classifyDayFromPunches(empPunches);
					if (status !== "absent" && status !== "weekend") {
						entries.push({
							pin,
							name: empPunches[0]?.employee_name ?? pin,
							status,
						});
					}
				});
				if (entries.length > 0) map.set(key, entries);
			});
		}
		return map;
	}, [punchesByDay, effectivePin]);

	// ── Employee options (for filtering UI) ────────────────────────────────────
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

	return {
		year,
		month,
		monthLabel,
		since,
		until,
		data,
		punchesByDay,
		dayStatusMap,
		employeeStatusesByDay,
		employeeOptions,
		selectedEmployee,
		setSelectedEmployee,
		goPrev,
		goNext,
		goToday,
		goPrevYear,
		goNextYear,
	};
}

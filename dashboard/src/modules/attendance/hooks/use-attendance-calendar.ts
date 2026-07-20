import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLingui } from "@lingui/react";
import { msg } from "@lingui/core/macro";

import { fetchCalendarMonth, type CalendarEmployeeDay } from "@/lib/api/attendance";
import { QueryKeys } from "@/lib/query-keys";
import { useCalendarNavigation } from "./use-calendar-navigation";
import type { EmployeeStatusEntry } from "../components/mini-status-bars";
import type { CalendarDayStatus } from "../compute";

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
	/** Device serial filter (comma-separated from page context). */
	deviceSns?: string;
	/** Punch status filter from page context. */
	status?: string;
};

// ── Helpers ────────────────────────────────────────────────────────────────────

/** Map backend status string to CalendarDayStatus for cell coloring. */
function toCellStatus(status: string): CalendarDayStatus {
	switch (status) {
		case "present": return "full";
		case "late": return "late";
		case "half": return "half";
		case "absent": return "absent";
		case "weekend": return "weekend";
		default: return "absent";
	}
}

/** Compute the dominant aggregate status for a day cell from per-employee statuses. */
function aggregateCellStatus(employees: CalendarEmployeeDay[]): {
	status: CalendarDayStatus;
	hours: number | null;
} {
	if (employees.length === 0) return { status: "absent", hours: null };

	let presentCount = 0;
	let lateCount = 0;
	let totalHours = 0;
	let employeesWithHours = 0;

	for (const emp of employees) {
		if (emp.status !== "absent" && emp.status !== "weekend") {
			presentCount++;
			if (emp.status === "late") lateCount++;
			if (emp.hours > 0) {
				totalHours += emp.hours;
				employeesWithHours++;
			}
		}
	}

	const totalCount = employees.length;
	const avgHours = employeesWithHours > 0 ? totalHours / employeesWithHours : null;

	let status: CalendarDayStatus;
	if (presentCount === 0) status = "absent";
	else if (lateCount > 0) status = "late";
	else if (presentCount >= totalCount * 0.8) status = "full";
	else status = "half";

	return { status, hours: avgHours };
}

// ── Hook ───────────────────────────────────────────────────────────────────────

/**
 * Attendance calendar orchestration hook.
 *
 * Uses the backend `/api/attendance/calendar` endpoint which returns
 * pre-computed per-employee-per-day status and hours. No raw punch
 * classification happens on the frontend.
 */
export function useAttendanceCalendar(options: UseAttendanceCalendarOptions = {}) {
	const { _ } = useLingui();

	// ── Navigation ───────────────────────────────────────────────────────────
	const { year, month, monthLabel, goPrev, goNext, goToday, goPrevYear, goNextYear } =
		useCalendarNavigation({ year: options.year, month: options.month });

	// Backward compat: userPins (array) → first element
	const userPin = options.userPin ?? options.userPins?.[0] ?? undefined;

	// ── Employee filter state ────────────────────────────────────────────────
	const [selectedEmployee, setSelectedEmployee] = useState<string>("");
	const effectivePin = userPin || (selectedEmployee || undefined);

	// ── Calendar endpoint query ──────────────────────────────────────────────
	const calendarQueryParams = useMemo(() => ({
		year,
		month,
		...(options.deviceSns ? { device_sns: options.deviceSns } : {}),
		...(effectivePin ? { user_pins: effectivePin } : {}),
		...(options.status ? { status: options.status } : {}),
	}), [year, month, options.deviceSns, options.status, effectivePin]);

	const { data: calendarData, isLoading } = useQuery({
		queryKey: QueryKeys.attendance.calendar(calendarQueryParams),
		queryFn: () => fetchCalendarMonth(calendarQueryParams),
	});

	// ── Day status map (for CalendarMonth cell colors) ───────────────────────
	const dayStatusMap: Record<string, { status: CalendarDayStatus; hours: number | null }> =
		useMemo(() => {
			const map: Record<string, { status: CalendarDayStatus; hours: number | null }> = {};
			if (!calendarData?.days) return map;

			for (const [date, employees] of Object.entries(calendarData.days)) {
				if (effectivePin && employees.length === 1) {
					// Single employee: use their status directly
					const emp = employees[0];
					map[date] = { status: toCellStatus(emp.status), hours: emp.hours || null };
				} else if (employees.length > 0) {
					// All employees: aggregate
					map[date] = aggregateCellStatus(employees);
				}
			}
			return map;
		}, [calendarData, effectivePin]);

	// ── Per-employee statuses (for scrollable mini status bars) ─────────────
	const employeeStatusesByDay = useMemo(() => {
		const map = new Map<string, EmployeeStatusEntry[]>();
		if (effectivePin || !calendarData?.days) return map;

		for (const [date, employees] of Object.entries(calendarData.days)) {
			const entries: EmployeeStatusEntry[] = employees
				.filter((e) => e.status !== "weekend")
				.map((e) => ({
					pin: e.pin,
					name: e.name || e.pin,
					status: toCellStatus(e.status),
					hours: e.hours || null,
				}));

			// Sort: present/late/half first, absent last, alphabetically
			entries.sort((a, b) => {
				if (a.status === "absent" && b.status !== "absent") return 1;
				if (a.status !== "absent" && b.status === "absent") return -1;
				return a.name.localeCompare(b.name);
			});

			if (entries.length > 0) map.set(date, entries);
		}
		return map;
	}, [calendarData, effectivePin]);

	// ── Employee options (for filtering UI) ──────────────────────────────────
	const employeeOptions: EmployeeOption[] = useMemo(() => {
		const seen = new Set<string>();
		const opts: EmployeeOption[] = [{ value: "", label: _(msg`All Employees`) }];
		if (!calendarData?.days) return opts;

		for (const employees of Object.values(calendarData.days)) {
			for (const emp of employees) {
				if (!seen.has(emp.pin)) {
					seen.add(emp.pin);
					opts.push({ value: emp.pin, label: emp.name || emp.pin });
				}
			}
		}
		return opts;
	}, [calendarData, _]);

	return {
		year,
		month,
		monthLabel,
		isLoading,
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

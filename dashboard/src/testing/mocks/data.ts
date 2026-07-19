/**
 * Test data factories for punch and employee attendance mocks.
 *
 * Every factory produces data shaped EXACTLY like the backend Rust DTOs.
 * Tests that use realistic data catch shape mismatches (ADR violations)
 * before they reach users.
 */

import type { Punch, PunchFilter } from "@/lib/api/punches";
import type {
	Employee,
	WorkDay,
	WorkPeriod,
	EmployeeWorkDays,
	EmployeeSummary,
	CalendarDay,
} from "@/lib/api/employees";
import type { PunchStatusValue } from "@shared/punch-statuses";

// ── Timestamp helpers ────────────────────────────────────────────────────────

/** Unix timestamp for a date string like "2026-07-15". Returns seconds. */
export function dateToTimestamp(dateStr: string, hours = 8, minutes = 0): number {
	const d = new Date(`${dateStr}T${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:00Z`);
	return Math.floor(d.getTime() / 1000);
}

/** Generate an ISO date string offset from a base date. */
export function isoDateOffset(base: string, days: number): string {
	const d = new Date(base);
	d.setDate(d.getDate() + days);
	return d.toISOString().split("T")[0]!;
}

// ── Punch factory ────────────────────────────────────────────────────────────

export function makePunch(overrides: Partial<Punch> = {}): Punch {
	return {
		id: `punch-${Math.random().toString(36).slice(2, 10)}`,
		user_pin: "1001",
		timestamp: dateToTimestamp("2026-07-15", 8, 0),
		status: "check_in" as PunchStatusValue,
		verify_mode: "fingerprint",
		device_sn: "DEV-001",
		device_label: "Main Entrance",
		employee_name: "Alice Test",
		is_anomaly: false,
		anomaly_type: null,
		...overrides,
	};
}

/** Create a realistic check_in + check_out pair for a single employee on a single day. */
export function makeWorkDayPunches(
	pin: string,
	name: string,
	dateStr: string,
	checkInHour = 8,
	checkOutHour = 17,
): Punch[] {
	const checkIn = makePunch({
		user_pin: pin,
		employee_name: name,
		timestamp: dateToTimestamp(dateStr, checkInHour, 0),
		status: "check_in" as PunchStatusValue,
	});

	const checkOut = makePunch({
		user_pin: pin,
		employee_name: name,
		timestamp: dateToTimestamp(dateStr, checkOutHour, 0),
		status: "check_out" as PunchStatusValue,
	});

	return [checkIn, checkOut];
}

/** Create punches for multiple employees over a date range. */
export function makeManyEmployeePunches(
	employees: { pin: string; name: string }[],
	dates: string[],
): Punch[] {
	const punches: Punch[] = [];
	for (const emp of employees) {
		for (const date of dates) {
			punches.push(...makeWorkDayPunches(emp.pin, emp.name, date));
		}
	}
	return punches;
}

// ── Cursor pagination helper ─────────────────────────────────────────────────

export function makeCursorPage(
	punches: Punch[],
	hasMore = false,
	nextCursor?: string,
): { punches: Punch[]; has_more: boolean; next_cursor: string | null } {
	return {
		punches,
		has_more: hasMore,
		next_cursor: nextCursor ?? null,
	};
}

// ── WorkDay / WorkPeriod factories ───────────────────────────────────────────

export function makeWorkPeriod(overrides: Partial<WorkPeriod> = {}): WorkPeriod {
	return {
		check_in: dateToTimestamp("2026-07-15", 8, 0),
		check_out: dateToTimestamp("2026-07-15", 17, 0),
		duration_secs: 9 * 3600,
		kind: "regular",
		...overrides,
	};
}

export function makeWorkDay(overrides: Partial<WorkDay> = {}): WorkDay {
	const date = overrides.date ?? "2026-07-15";
	return {
		date,
		user_pin: "1001",
		status: "present",
		total_regular_seconds: 8 * 3600,
		total_break_seconds: 1800,
		total_overtime_seconds: 0,
		net_work_seconds: 8 * 3600,
		is_present_now: false,
		anomaly_count: 0,
		periods: [makeWorkPeriod({ check_in: dateToTimestamp(date, 8, 0), check_out: dateToTimestamp(date, 17, 0) })],
		...overrides,
	};
}

export function makeWorkDays(
	pin: string,
	dates: string[],
	opts: { status?: string; anomalyCount?: number } = {},
): EmployeeWorkDays {
	const work_days = dates.map((date) =>
		makeWorkDay({
			date,
			user_pin: pin,
			status: opts.status ?? "present",
			anomaly_count: opts.anomalyCount ?? 0,
		}),
	);
	return { user_pin: pin, work_days };
}

export function makeEmployeeSummary(overrides: Partial<EmployeeSummary> = {}): EmployeeSummary {
	return {
		user_pin: "1001",
		total_days: 22,
		present_days: 18,
		late_days: 2,
		half_days: 1,
		absent_days: 1,
		avg_hours_per_day: 7.8,
		total_overtime_seconds: 7200,
		total_regular_seconds: 158400,
		work_days: [
			makeWorkDay({ date: "2026-07-01" }),
			makeWorkDay({ date: "2026-07-02" }),
			makeWorkDay({ date: "2026-07-03", status: "late" }),
		],
		...overrides,
	};
}

export function makeCalendarDay(overrides: Partial<CalendarDay> = {}): CalendarDay {
	return {
		date: "2026-07-15",
		status_code: 1, // present
		hours: 8,
		is_working_day: true,
		...overrides,
	};
}

// ── Employee factory ─────────────────────────────────────────────────────────

export function makeEmployee(overrides: Partial<Employee> = {}): Employee {
	return {
		id: `emp-${Math.random().toString(36).slice(2, 8)}`,
		pin: "1001",
		name: "Alice Test",
		department_id: "dept-engineering",
		department: "Engineering",
		external_id: null,
		active: true,
		created_at: dateToTimestamp("2026-01-01"),
		updated_at: dateToTimestamp("2026-07-01"),
		...overrides,
	};
}

// ── Filter factory ───────────────────────────────────────────────────────────

export function makePunchFilter(overrides: Partial<PunchFilter> = {}): PunchFilter {
	return {
		since: "2026-07-01",
		until: "2026-07-15",
		limit: 20,
		...overrides,
	};
}

// ── Test assertion helpers ────────────────────────────────────────────────────

/**
 * Assert that a mocked function was called with specific filter parameters.
 *
 * Useful for verifying filter propagation through hooks that call usePunchData.
 * Only checks the keys present in `expected` — ignores other keys in the actual call.
 *
 * @example
 * ```ts
 * assertPunchFilterCall(vi.mocked(usePunchData), { status: "check_in", device_sns: ["DEV-001"] });
 * ```
 */
export function assertPunchFilterCall(
	mockFn: { mock: { calls: Array<[unknown]> } },
	expected: Partial<PunchFilter>,
) {
	const calls = mockFn.mock.calls;
	if (calls.length === 0) {
		throw new Error("assertPunchFilterCall: mock function was never called");
	}
	const lastCall = calls[calls.length - 1]?.[0] as Record<string, unknown> | undefined;
	if (!lastCall) {
		throw new Error("assertPunchFilterCall: last call has no arguments");
	}
	for (const [key, value] of Object.entries(expected)) {
		if (!(key in lastCall)) {
			throw new Error(
				`assertPunchFilterCall: expected key "${key}" not found in filter call. ` +
				`Got keys: ${Object.keys(lastCall).join(", ")}`,
			);
		}
		if (JSON.stringify(lastCall[key]) !== JSON.stringify(value)) {
			throw new Error(
				`assertPunchFilterCall: key "${key}" mismatch. ` +
				`Expected: ${JSON.stringify(value)}, Got: ${JSON.stringify(lastCall[key])}`,
			);
		}
	}
}

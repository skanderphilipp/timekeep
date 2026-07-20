import { apiGet } from "./client";

// ── Types (mirrors Rust DTOs in crates/timekeep-api/src/dto.rs) ───────────

/** One employee's status on a single calendar day. */
export type CalendarEmployeeDay = {
	pin: string;
	name: string;
	/** "present" | "late" | "half" | "absent" | "weekend" */
	status: string;
	hours: number;
	overtime_hours: number;
	break_minutes: number;
	anomaly_count: number;
	is_late: boolean;
};

/** Calendar month response — map of "YYYY-MM-DD" → employee summaries. */
export type CalendarMonthResponse = {
	year: number;
	month: number;
	days: Record<string, CalendarEmployeeDay[]>;
};

/** Single timeline block (bar segment) for one employee. */
export type TimelineBlock = {
	left: number;
	width: number;
	color: string;
	title: string;
};

/**
 * One employee's timeline data for a single day.
 * The `summary` fields (CalendarEmployeeDay) are flattened into this object
 * via `#[serde(flatten)]` on the Rust side.
 */
export type TimelineEmployeeBlocks = {
	pin: string;
	name: string;
	blocks: TimelineBlock[];
	// Flattened CalendarEmployeeDay fields:
	status: string;
	hours: number;
	overtime_hours: number;
	break_minutes: number;
	anomaly_count: number;
	is_late: boolean;
};

/** Single-day timeline response. */
export type TimelineDayResponse = {
	date: string;
	employees: TimelineEmployeeBlocks[];
};

// ── Query params ────────────────────────────────────────────────────────

export type CalendarQueryParams = {
	year: number;
	month: number;
	device_sns?: string;
	user_pins?: string;
	status?: string;
};

export type TimelineQueryParams = {
	date: string; // YYYY-MM-DD
	device_sns?: string;
	user_pins?: string;
	status?: string;
};

// ── API functions ───────────────────────────────────────────────────────

function buildQuery(params: Record<string, string | number | undefined>): string {
	const search = new URLSearchParams();
	for (const [key, value] of Object.entries(params)) {
		if (value !== undefined && value !== "") {
			search.set(key, String(value));
		}
	}
	const qs = search.toString();
	return qs ? `?${qs}` : "";
}

export function fetchCalendarMonth(params: CalendarQueryParams): Promise<CalendarMonthResponse> {
	return apiGet<CalendarMonthResponse>(
		`attendance/calendar${buildQuery(params)}`,
	).json();
}

export function fetchTimelineDay(params: TimelineQueryParams): Promise<TimelineDayResponse> {
	return apiGet<TimelineDayResponse>(
		`attendance/timeline${buildQuery(params)}`,
	).json();
}

/**
 * Attendance computation — single source of truth for classifying punches
 * into attendance statuses, building timeline blocks, and computing summaries.
 *
 * Previously duplicated across:
 * - dashboard/components/attendance-calendar/use-attendance-calendar.ts (classifyDayFromPunches)
 * - punches/components/daily-timeline/attendance-summary.ts (computeAttendanceSummary)
 * - punches/components/daily-timeline/daily-timeline-blocks.ts (buildBlocks)
 *
 * Now co-located in the attendance bounded context.
 */

import type { Punch } from "@/lib/api/punches";

// ── Types ──────────────────────────────────────────────────────────────────────

export type CalendarDayStatus = "full" | "half" | "late" | "absent" | "weekend";

export type TimelineBlockColor = "present" | "warning" | "overtime" | "default";

export type TimelineBlock = {
	left: number;
	width: number;
	color: TimelineBlockColor;
	title?: string;
};

export type AttendanceSummary = {
	totalPunches: number;
	firstCheckIn: number | null;
	lastCheckOut: number | null;
	presentMinutes: number;
	breakMinutes: number;
	overtimeMinutes: number;
	events: AttendanceEvent[];
	anomalyCount: number;
};

export type AttendanceEvent = {
	timestamp: number;
	time: string;
	status: string;
	isAnomaly: boolean;
};

// ── Calendar day classification ────────────────────────────────────────────────

/**
 * TODO(ENTERPRISE): Replace with backend AttendanceCalculator output.
 *
 * Phase: Backend integration (Phase 3 of chart roadmap)
 * Impact: Status classification is duplicated from the Rust domain layer.
 *         Inaccurate when work policy differs from defaults.
 * Fix: Use GET /api/attendance/by-employee/{pin}/calendar response
 *       instead of computing locally from raw punches.
 */
export function classifyDayFromPunches(punches: Punch[]): {
	status: CalendarDayStatus;
	hours: number | null;
} {
	if (punches.length === 0) return { status: "absent", hours: null };

	let totalSeconds = 0;
	let checkInTime: number | null = null;
	const sorted = [...punches].sort((a, b) => a.timestamp - b.timestamp);
	let hasLate = false;

	// Period start/end statuses — break_out starts a new work period,
	// break_in ends the current one. overtime_in/out follow the same pattern.
	const PERIOD_START = new Set(["check_in", "break_out", "overtime_in"]);
	const PERIOD_END = new Set(["check_out", "break_in", "overtime_out"]);

	for (const p of sorted) {
		if (PERIOD_START.has(p.status)) {
			// Close any previously open period
			if (checkInTime != null) {
				totalSeconds += p.timestamp - checkInTime;
			}
			checkInTime = p.timestamp;
			// Late detection: only relevant for the first check_in
			if (p.status === "check_in") {
				const d = new Date(p.timestamp * 1000);
				if (d.getHours() >= 9) hasLate = true;
			}
		} else if (PERIOD_END.has(p.status) && checkInTime != null) {
			totalSeconds += p.timestamp - checkInTime;
			checkInTime = null;
		}
	}

	const hours = totalSeconds / 3600;

	if (hasLate) return { status: "late", hours };
	if (hours >= 4) return { status: "full", hours };
	if (hours > 0) return { status: "half", hours };
	return { status: "absent", hours: null };
}

// ── Timeline block building ────────────────────────────────────────────────────

const STATUS_CLASS: Record<string, TimelineBlockColor> = {
	check_in: "present",
	check_out: "present",
	break_in: "warning",
	break_out: "warning",
	overtime_in: "overtime",
	overtime_out: "overtime",
};

export function statusLabel(status: string, t: (key: string) => string): string {
	const labels: Record<string, string> = {
		check_in: t("Check In"),
		check_out: t("Check Out"),
		break_in: t("Break In"),
		break_out: t("Break Out"),
		overtime_in: t("Overtime In"),
		overtime_out: t("Overtime Out"),
	};
	return labels[status] ?? status;
}

function timeToMinutes(ts: number): number {
	const d = new Date(ts * 1000);
	return d.getHours() * 60 + d.getMinutes();
}

export function buildBlocks(
	punches: Punch[],
	t: (key: string) => string,
): TimelineBlock[] {
	const sorted = [...punches].sort((a, b) => a.timestamp - b.timestamp);
	const blocks: TimelineBlock[] = [];
	let inBlock: { startMinute: number; status: string } | null = null;

	for (const punch of sorted) {
		const minute = timeToMinutes(punch.timestamp);

		if (
			punch.status === "check_in" ||
			punch.status === "break_in" ||
			punch.status === "overtime_in"
		) {
			if (inBlock) {
				blocks.push(createBlock(inBlock.startMinute, minute, inBlock.status, t));
			}
			inBlock = { startMinute: minute, status: punch.status };
		} else if (inBlock) {
			blocks.push(createBlock(inBlock.startMinute, minute, inBlock.status, t));
			inBlock = null;
		} else {
			blocks.push(createBlock(minute - 1, minute, punch.status, t));
		}
	}

	if (inBlock) {
		blocks.push(
			createBlock(
				inBlock.startMinute,
				Math.min(inBlock.startMinute + 30, 24 * 60),
				inBlock.status,
				t,
			),
		);
	}

	return blocks;
}

function createBlock(
	startMinute: number,
	endMinute: number,
	status: string,
	t: (key: string) => string,
): TimelineBlock {
	const label = statusLabel(status, t);
	const startStr = `${String(Math.floor(startMinute / 60)).padStart(2, "0")}:${String(startMinute % 60).padStart(2, "0")}`;
	const endStr = `${String(Math.floor(endMinute / 60)).padStart(2, "0")}:${String(endMinute % 60).padStart(2, "0")}`;

	return {
		left: (startMinute / (24 * 60)) * 100,
		width: Math.max(((endMinute - startMinute) / (24 * 60)) * 100, 0.5),
		color: STATUS_CLASS[status] ?? "default",
		title: `${label}: ${startStr} - ${endStr}`,
	};
}

// ── Legend ─────────────────────────────────────────────────────────────────────

export function buildLegendItems(t: (key: string) => string) {
	return [
		{ color: "present" as const, label: t("Present") },
		{ color: "warning" as const, label: t("Break") },
		{ color: "overtime" as const, label: t("Overtime") },
	];
}

// ── Attendance summary ─────────────────────────────────────────────────────────

export function computeAttendanceSummary(punches: Punch[]): AttendanceSummary {
	const sorted = [...punches].sort((a, b) => a.timestamp - b.timestamp);

	const events: AttendanceEvent[] = sorted.map((p) => ({
		timestamp: p.timestamp,
		time: formatTimestamp(p.timestamp),
		status: p.status,
		isAnomaly: p.is_anomaly ?? false,
	}));

	let presentMinutes = 0;
	let breakMinutes = 0;
	let overtimeMinutes = 0;

	let inBlock: { timestamp: number; status: string } | null = null;
	for (const punch of sorted) {
		if (
			punch.status === "check_in" ||
			punch.status === "break_out" ||
			punch.status === "break_in" ||
			punch.status === "overtime_in"
		) {
			if (inBlock) {
				const duration = (punch.timestamp - inBlock.timestamp) / 60;
				addDuration(inBlock.status, duration);
			}
			inBlock = { timestamp: punch.timestamp, status: punch.status };
		} else if (inBlock) {
			const duration = (punch.timestamp - inBlock.timestamp) / 60;
			addDuration(inBlock.status, duration);
			inBlock = null;
		}
	}

	if (inBlock) {
		const lastTs = sorted.length > 0 ? sorted[sorted.length - 1].timestamp : inBlock.timestamp;
		const duration = Math.max(0, (lastTs - inBlock.timestamp) / 60);
		addDuration(inBlock.status, duration);
	}

	function addDuration(status: string, minutes: number): void {
		if (status === "check_in" || status === "break_in") {
			presentMinutes += minutes;
		} else if (status === "break_out") {
			breakMinutes += minutes;
		} else if (status.startsWith("overtime")) {
			overtimeMinutes += minutes;
		}
	}

	return {
		totalPunches: sorted.length,
		firstCheckIn: sorted.length > 0 ? sorted[0].timestamp : null,
		lastCheckOut: sorted.length > 0 ? sorted[sorted.length - 1].timestamp : null,
		presentMinutes,
		breakMinutes,
		overtimeMinutes,
		events,
		anomalyCount: sorted.filter((p) => p.is_anomaly).length,
	};
}

// ── Formatting helpers ─────────────────────────────────────────────────────────

function formatTimestamp(ts: number): string {
	const d = new Date(ts * 1000);
	return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export function formatDuration(totalMinutes: number): string {
	if (totalMinutes <= 0) return "0m";
	const hours = Math.floor(totalMinutes / 60);
	const minutes = Math.round(totalMinutes % 60);
	if (hours === 0) return `${minutes}m`;
	if (minutes === 0) return `${hours}h`;
	return `${hours}h ${minutes}m`;
}

// ── Multi-employee aggregation ─────────────────────────────────────────────────

export type DayAggregation = {
	status: CalendarDayStatus;
	presentCount: number;
	totalCount: number;
	avgHours: number | null;
};

/**
 * Aggregate punches from multiple employees into a single day summary.
 *
 * Used for the "All Employees" calendar view. Each employee is classified
 * individually, then results are aggregated:
 * - status = "full" if majority present, "late" if any late, "absent" if none
 * - presentCount = number of employees with any punches
 * - totalCount = total unique employees who punched that day
 * - avgHours = average hours across employees with punches
 */
export function aggregateDayStatus(punches: Punch[]): DayAggregation {
	if (punches.length === 0) {
		return { status: "absent", presentCount: 0, totalCount: 0, avgHours: null };
	}

	// Group punches by employee
	const byEmployee = new Map<string, Punch[]>();
	for (const p of punches) {
		const existing = byEmployee.get(p.user_pin) ?? [];
		existing.push(p);
		byEmployee.set(p.user_pin, existing);
	}

	let presentCount = 0;
	let lateCount = 0;
	let totalHours = 0;
	let employeesWithHours = 0;

	for (const [, empPunches] of byEmployee) {
		const { status, hours } = classifyDayFromPunches(empPunches);
		if (status !== "absent") {
			presentCount++;
			if (status === "late") lateCount++;
			if (hours != null) {
				totalHours += hours;
				employeesWithHours++;
			}
		}
	}

	const totalCount = byEmployee.size;
	const avgHours = employeesWithHours > 0 ? totalHours / employeesWithHours : null;

	let status: CalendarDayStatus;
	if (presentCount === 0) {
		status = "absent";
	} else if (lateCount > 0) {
		status = "late";
	} else if (presentCount >= totalCount * 0.8) {
		status = "full";
	} else {
		status = "half";
	}

	return { status, presentCount, totalCount, avgHours };
}

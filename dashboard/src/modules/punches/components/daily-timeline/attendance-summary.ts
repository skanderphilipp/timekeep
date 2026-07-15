import type { Punch } from "@/lib/api";

/**
 * Aggregated attendance summary for a single employee on a given day.
 *
 * Computed from raw punches by the `computeAttendanceSummary` function.
 * Used to render the sidebar detail panel when an employee row is clicked
 * in the DailyTimeline.
 */
export type AttendanceSummary = {
	/** Total punches recorded. */
	totalPunches: number;
	/** First check-in timestamp (Unix seconds), if any. */
	firstCheckIn: number | null;
	/** Last check-out timestamp (Unix seconds), if any. */
	lastCheckOut: number | null;
	/** Total present time in minutes (check-in → break-out + break-in → check-out). */
	presentMinutes: number;
	/** Total break time in minutes (break-out → break-in). */
	breakMinutes: number;
	/** Total overtime minutes (overtime-in → overtime-out). */
	overtimeMinutes: number;
	/** Punch statuses in chronological order with formatted times. */
	events: AttendanceEvent[];
	/** Number of anomalous punches. */
	anomalyCount: number;
};

export type AttendanceEvent = {
	/** Unix timestamp in seconds. */
	timestamp: number;
	/** Human-readable time string (HH:MM). */
	time: string;
	/** Punch status value (check_in, break_out, etc.). */
	status: string;
	/** Whether this punch is flagged as anomalous. */
	isAnomaly: boolean;
};

/**
 * Compute an aggregated attendance summary from a list of punches.
 *
 * Pairs consecutive in/out events to calculate present, break, and overtime
 * durations. Orphaned check-ins are counted as present up to the last known
 * time, and orphaned check-outs are ignored.
 *
 * @param punches - Raw punch records for one employee on one day.
 * @returns Aggregated summary suitable for the sidebar detail panel.
 */
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

	// Pair consecutive in/out events.
	// "In" events open a block; the next "in" event or matching "out" event closes it.
	// Unlike the visual block builder (daily-timeline-blocks.ts), this tracks break
	// time correctly by treating break_out as opening a break block.
	let inBlock: { timestamp: number; status: string } | null = null;
	for (const punch of sorted) {
		if (
			punch.status === "check_in" ||
			punch.status === "break_out" ||
			punch.status === "break_in" ||
			punch.status === "overtime_in"
		) {
			// Close the previous block (if any) before opening a new one
			if (inBlock) {
				const duration = (punch.timestamp - inBlock.timestamp) / 60;
				addDuration(inBlock.status, duration);
			}
			inBlock = { timestamp: punch.timestamp, status: punch.status };
		} else if (inBlock) {
			// Out event (check_out, overtime_out) closes the current block
			const duration = (punch.timestamp - inBlock.timestamp) / 60;
			addDuration(inBlock.status, duration);
			inBlock = null;
		}
	}

	// Orphaned check-in → count as present up to the last event timestamp
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

function formatTimestamp(ts: number): string {
	const d = new Date(ts * 1000);
	return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/**
 * Format minutes into a human-readable duration string (e.g. "7h 42m").
 */
export function formatDuration(totalMinutes: number): string {
	if (totalMinutes <= 0) return "0m";
	const hours = Math.floor(totalMinutes / 60);
	const minutes = Math.round(totalMinutes % 60);
	if (hours === 0) return `${minutes}m`;
	if (minutes === 0) return `${hours}h`;
	return `${hours}h ${minutes}m`;
}

import { useMemo, useState, useCallback, useEffect } from "react";

import { AttendanceTimelineView } from "@/modules/attendance";
import type { Punch } from "@/lib/api";

// ── Types ──────────────────────────────────────────────────────────────

type PunchTimelineViewProps = {
	/** The date to display the timeline for (from the page's date filter). */
	date: Date | null;
	/** Punches for the current filter context (used to derive employee list). */
	punches: Punch[];
	/** Device serial filter from page context. */
	deviceSns?: string;
	/** Punch status filter from page context. */
	status?: string;
};

// ── Component ──────────────────────────────────────────────────────────

/**
 * PunchTimelineView — daily timeline visualization for punches.
 *
 * Wraps {@link AttendanceTimelineView} with date state management synced
 * to the parent page's filter context. Data comes from the
 * `/api/attendance/timeline` backend endpoint.
 */
export function PunchTimelineView({
	date,
	punches,
	deviceSns,
	status,
}: PunchTimelineViewProps) {
	// Default to today when no date filter is set
	const effectiveDate = useMemo(() => date ?? new Date(), [date]);

	// Track the selected date for the timeline
	const [timelineDate, setTimelineDate] = useState(effectiveDate);

	// Sync when page filter changes
	useEffect(() => {
		if (date) setTimelineDate(date);
	}, [date?.toDateString()]);

	// Derive employee list from loaded punches (for the header labels)
	const employees = useMemo(() => {
		const seen = new Set<string>();
		const list: { pin: string; name: string }[] = [];
		for (const p of punches) {
			if (!seen.has(p.user_pin)) {
				seen.add(p.user_pin);
				list.push({ pin: p.user_pin, name: p.employee_name ?? p.user_pin });
			}
		}
		return list;
	}, [punches]);

	const handleDateChange = useCallback((newDate: Date) => {
		setTimelineDate(newDate);
	}, []);

	return (
		<AttendanceTimelineView
			date={timelineDate}
			employees={employees.length > 0 ? employees : undefined}
			deviceSns={deviceSns}
			status={status}
			onDateChange={handleDateChange}
		/>
	);
}

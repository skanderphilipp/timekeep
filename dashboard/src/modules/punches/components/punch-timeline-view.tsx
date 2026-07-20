import { useMemo, useState, useCallback, useEffect } from "react";

import { AttendanceTimelineView } from "@/modules/attendance";
import type { Punch } from "@/lib/api";
import type { PunchFilter } from "@/lib/api";

// ── Types ──────────────────────────────────────────────────────────────

type PunchTimelineViewProps = {
	/** The date to display the timeline for (from the page's date filter). */
	date: Date | null;
	/** Punches for the current filter context (used to derive employee list). */
	punches: Punch[];
	/**
	 * Additional filter context from the parent page (status, device_sns, search, etc.).
	 * Propagated to usePunchData so timeline data matches page-level filters.
	 */
	filterContext?: Partial<PunchFilter>;
	/** Explicit date range from parent page filter (Bug 3 fix). */
	filterSince?: string;
	filterUntil?: string;
};

// ── Component ──────────────────────────────────────────────────────────

/**
 * PunchTimelineView — daily timeline visualization for punches.
 *
 * Wraps {@link AttendanceTimelineView} with date state management synced
 * to the parent page's filter context. Supports day-by-day navigation
 * via prev/next/today buttons.
 *
 * Rendered by {@link DataListView} via `renderCustomView` when the user
 * selects "Timeline" from the ViewPicker.
 */
export function PunchTimelineView({
	date,
	punches,
	filterContext,
	filterSince,
	filterUntil,
}: PunchTimelineViewProps) {
	// Default to today when no date filter is set
	const effectiveDate = useMemo(() => date ?? new Date(), [date]);

	// Track the selected date for the timeline (starts from page filter, then user can navigate)
	const [timelineDate, setTimelineDate] = useState(effectiveDate);

	// Sync when page filter changes
	useEffect(() => {
		if (date) setTimelineDate(date);
	}, [date?.toDateString()]);

	// Derive employee list from loaded punches
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
			filterContext={filterContext}
			filterSince={filterSince}
			filterUntil={filterUntil}
			onDateChange={handleDateChange}
		/>
	);
}

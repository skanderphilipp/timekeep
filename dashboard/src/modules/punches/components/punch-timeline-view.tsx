import { useMemo } from "react";

import { DailyTimeline } from "./daily-timeline";
import type { Punch } from "@/lib/api";

// ── Types ──────────────────────────────────────────────────────────────

type PunchTimelineViewProps = {
	/** The date to display the timeline for (from the page's date filter). */
	date: Date | null;
	/** Raw filter strings from the parent page (syncs timeline with active filters). */
	filterSince?: string;
	filterUntil?: string;
	/** Punches for the current filter context (used to derive employee list). */
	punches: Punch[];
	/** Whether data is loading. */
	isLoading: boolean;
};

// ── Component ──────────────────────────────────────────────────────────

/**
 * PunchTimelineView — daily timeline visualization for punches.
 *
 * Delegates to the existing {@link DailyTimeline} component. Displays
 * employee punch blocks on a 24-hour timeline for the selected date.
 *
 * When no date filter is active, defaults to today so the timeline
 * always has data to render.
 *
 * Passes `filterSince`/`filterUntil` from the parent page's active
 * date range so the timeline respects the same date window as the table.
 *
 * Rendered by {@link DataListView} via `renderCustomView` when the user
 * selects "Timeline" from the ViewPicker.
 */
export function PunchTimelineView({
	date,
	filterSince,
	filterUntil,
	punches,
	isLoading,
}: PunchTimelineViewProps) {
	// Derive employee list from loaded punches
	const employees = useMemo(
		() => {
			const seen = new Set<string>();
			const list: { pin: string; name: string }[] = [];
			for (const p of punches) {
				if (!seen.has(p.user_pin)) {
					seen.add(p.user_pin);
					list.push({ pin: p.user_pin, name: p.employee_name ?? p.user_pin });
				}
			}
			return list;
		},
		[punches],
	);

	// Default to today when no date filter is set, so the timeline always renders.
	const effectiveDate = useMemo(() => date ?? new Date(), [date]);

	if (isLoading) {
		return (
			<DailyTimeline
				date={effectiveDate}
				filterSince={filterSince}
				filterUntil={filterUntil}
				employees={[]}
			/>
		);
	}

	return (
		<DailyTimeline
			date={effectiveDate}
			filterSince={filterSince}
			filterUntil={filterUntil}
			employees={employees.length > 0 ? employees : undefined}
		/>
	);
}

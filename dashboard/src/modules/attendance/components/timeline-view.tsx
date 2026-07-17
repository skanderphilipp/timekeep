import { useMemo } from "react";
import { useSetAtom } from "jotai";
import { msg } from "@lingui/core/macro";
import { useLingui } from "@lingui/react";

import { openSidePanelAtom } from "@/infrastructure/state";
import { Timeline } from "@/modules/shared/components";
import { HOUR_MARKERS } from "../constants/hour-markers";
import { useTimelineDate } from "../hooks/use-timeline-date";
import { usePunchBlocks } from "../hooks/use-punch-blocks";
import { EmployeeAttendanceSummary } from "./employee-attendance-summary";
import { TimelineToolbar } from "./timeline-toolbar";
import type { TimelineEmployee } from "../types";

// ── Types ──────────────────────────────────────────────────────────────────────

export type TimelineViewProps = {
	date: Date;
	/** Optional: explicit date range from parent filters. */
	filterSince?: string;
	filterUntil?: string;
	employees?: TimelineEmployee[];
	/** Called when the user navigates to a different day. */
	onDateChange?: (date: Date) => void;
	className?: string;
};

// ── Component ──────────────────────────────────────────────────────────────────

/**
 * AttendanceTimelineView — daily timeline visualization.
 *
 * Thin composite that delegates:
 * - Day navigation → useTimelineDate
 * - Data fetching + block building → usePunchBlocks
 * - Side panel content → EmployeeAttendanceSummary
 * - Toolbar → TimelineToolbar
 * - Rendering → shared Timeline
 *
 * Twenty pattern: 60-line thin composites, all logic in hooks.
 */
export function AttendanceTimelineView({
	date: initialDate,
	filterSince,
	filterUntil,
	employees,
	onDateChange,
	className,
}: TimelineViewProps) {
	const { _ } = useLingui();
	const openSidePanel = useSetAtom(openSidePanelAtom);

	// ── Translation (keeps compute.ts pure, no Lingui dependency) ─────
	const translate = useMemo(
		() => (key: string) => {
			const labels: Record<string, string> = {
				"Check In": _(msg`Check In`),
				"Check Out": _(msg`Check Out`),
				"Break In": _(msg`Break In`),
				"Break Out": _(msg`Break Out`),
				"Overtime In": _(msg`Overtime In`),
				"Overtime Out": _(msg`Overtime Out`),
				"Present": _(msg`Present`),
				"Break": _(msg`Break`),
				"Overtime": _(msg`Overtime`),
			};
			return labels[key] ?? key;
		},
		[_],
	);

	// ── Day navigation ──────────────────────────────────────────────
	const { date, goPrev, goNext, goToday } = useTimelineDate(
		initialDate,
		onDateChange,
	);

	// ── Data fetching + block building ──────────────────────────────
	const { rows, legendItems, isLoading, punchesByEmployee, employeeList } =
		usePunchBlocks({
			date,
			filterSince,
			filterUntil,
			employees,
			translate,
		});

	// ── Wire click handlers ─────────────────────────────────────────
	const clickableRows = useMemo(
		() =>
			rows.map((row) => ({
				...row,
				onClick: () => {
					const emp = employeeList.find((e) => e.pin === row.id);
					if (!emp) return;
					const punches = punchesByEmployee.get(row.id) ?? [];
					openSidePanel({
						title: emp.name,
						render: () => (
							<EmployeeAttendanceSummary employee={emp} punches={punches} />
						),
					});
				},
			})),
		[rows, employeeList, punchesByEmployee, openSidePanel],
	);

	// ── Render ─────────────────────────────────────────────────────
	return (
		<div>
			<TimelineToolbar
				date={date}
				onPrev={goPrev}
				onNext={goNext}
				onToday={goToday}
			/>
			<Timeline
				headerLabel={_(msg`Employee`)}
				hourMarkers={HOUR_MARKERS}
				rows={clickableRows}
				isLoading={isLoading}
				legendItems={legendItems}
				emptyState={_(msg`No punch records for this day.`)}
				className={className}
			/>
		</div>
	);
}

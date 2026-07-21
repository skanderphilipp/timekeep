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
	/** Device serial filter from page context. */
	deviceSns?: string;
	/** Punch status filter from page context. */
	status?: string;
	employees?: TimelineEmployee[];
	/** Called when the user navigates to a different day. */
	onDateChange?: (date: Date) => void;
	className?: string;
};

// ── Component ──────────────────────────────────────────────────────────────────

/**
 * AttendanceTimelineView — daily timeline visualization.
 *
 * Data comes from the `/api/attendance/timeline` backend endpoint
 * which returns pre-computed blocks and summaries per employee.
 */
export function AttendanceTimelineView({
	date: initialDate,
	deviceSns,
	status,
	employees,
	onDateChange,
	className,
}: TimelineViewProps) {
	const { _ } = useLingui();
	const openSidePanel = useSetAtom(openSidePanelAtom);

	// ── Translation ──────────────────────────────────────────────────
	const translate = useMemo(
		() => (key: string) => {
			const labels: Record<string, string> = {
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
	const { rows, legendItems, isLoading, employeeData, employeeList } =
		usePunchBlocks({ date, deviceSns, status, employees, translate });

	// ── Wire click handlers ─────────────────────────────────────────
	const clickableRows = useMemo(
		() =>
			rows.map((row) => ({
				...row,
				onClick: () => {
					const emp = employeeList.find((e) => e.pin === row.id);
					if (!emp) return;
					const tlData = employeeData.find((d) => d.pin === row.id);
					openSidePanel({
						title: emp.name,
						render: () => (
							<EmployeeAttendanceSummary
								employee={emp}
								timelineData={tlData}
							/>
						),
					});
				},
			})),
		[rows, employeeList, employeeData, openSidePanel],
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

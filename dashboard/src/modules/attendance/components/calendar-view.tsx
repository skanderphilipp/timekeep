import { useCallback } from "react";
import { useSetAtom } from "jotai";
import { useLingui } from "@lingui/react";
import { msg } from "@lingui/core/macro";

import { openSidePanelAtom } from "@/infrastructure/state";
import { CalendarMonth, type CalendarDayData } from "@/modules/shared/components";
import type { ViewType } from "@/modules/shared/components";
import { useAttendanceCalendar } from "../hooks/use-attendance-calendar";
import { CalendarToolbar } from "./calendar-toolbar";
import { DayDetailPanel } from "./day-detail-panel";
import { MiniStatusBars } from "./mini-status-bars";
import styles from "./calendar-view.module.scss";

// ── Types ──────────────────────────────────────────────────────────────

export type AttendanceCalendarViewProps = {
	year: number;
	month: number;
	/** Optional: filter to a single employee PIN. */
	userPin?: string;
	/**
	 * Explicit date range from parent page filter context (Bug 2 fix).
	 * When provided, overrides the auto-generated ±7 day range.
	 */
	filterSince?: string;
	/** See `filterSince`. */
	filterUntil?: string;
	/**
	 * Additional filter context from parent page (status, device_sns, search, etc.).
	 */
	filterContext?: Record<string, unknown>;
	/** Called when a day cell is clicked. If omitted, defaults to side panel. */
	onDayClick?: (date: string) => void;
};

// ── Component ──────────────────────────────────────────────────────────

/**
 * AttendanceCalendarView — monthly attendance calendar.
 *
 * Thin composite that delegates:
 * - Navigation + data → useAttendanceCalendar
 * - Toolbar → CalendarToolbar
 * - Day detail panel → DayDetailPanel
 * - Rendering → shared CalendarMonth
 *
 * Twenty pattern: thin composites (~60 lines), all logic in hooks.
 */
export function AttendanceCalendarView({
	year,
	month,
	userPin,
	filterSince,
	filterUntil,
	filterContext,
	onDayClick,
}: AttendanceCalendarViewProps) {
	const { _ } = useLingui();
	const openSidePanel = useSetAtom(openSidePanelAtom);

	// Delegate all data handling to the hook
	const {
		punchesByDay,
		dayStatusMap,
		employeeStatusesByDay,
		goPrev,
		goNext,
		goToday,
		goPrevYear,
		goNextYear,
		year: currentYear,
		month: currentMonth,
	} = useAttendanceCalendar({ year, month, userPin, filterSince, filterUntil, filterContext });

	// ── Day click handler ───────────────────────────────────────────
	const handleDayClick = useCallback(
		(day: CalendarDayData) => {
			if (onDayClick) {
				onDayClick(day.date);
				return;
			}
			const punches = punchesByDay.get(day.date) ?? [];
			openSidePanel({
				title: day.date,
				render: () => <DayDetailPanel day={day} punches={punches} />,
			});
		},
		[onDayClick, punchesByDay, openSidePanel],
	);

	return (
		<div>
			<CalendarToolbar
				year={currentYear}
				month={currentMonth}
				onPrev={goPrev}
				onNext={goNext}
				onToday={goToday}
				onPrevYear={goPrevYear}
				onNextYear={goNextYear}
			/>
			<CalendarMonth
				year={currentYear}
				month={currentMonth}
				dayStatus={dayStatusMap}
				onDayClick={handleDayClick}
				weekStartsOn={1}
				renderDayContent={
					!userPin
						? (day) => {
							const statuses = employeeStatusesByDay.get(day.date);
							return statuses && statuses.length > 0 ? (
								<MiniStatusBars statuses={statuses} compact />
							) : null;
						}
						: undefined
				}
				footer={
					<div className={styles.legend}>
						<span className={styles.legendItem}>
							<span className={`${styles.swatch} ${styles.swatchPresent}`} />
							{_(msg`Present`)}
						</span>
						<span className={styles.legendItem}>
							<span className={`${styles.swatch} ${styles.swatchLate}`} />
							{_(msg`Late`)}
						</span>
						<span className={styles.legendItem}>
							<span className={`${styles.swatch} ${styles.swatchAbsent}`} />
							{_(msg`Absent`)}
						</span>
					</div>
				}
			/>
		</div>
	);
}

/**
 * Factory that creates the renderCustomView callback for DataListView.
 */
export function createCalendarRenderView(
	year: number,
	month: number,
	onDayClick?: (date: string) => void,
): (view: ViewType) => React.ReactNode {
	return (view: ViewType) => {
		if (view === "calendar") {
			return <AttendanceCalendarView year={year} month={month} onDayClick={onDayClick} />;
		}
		return null;
	};
}

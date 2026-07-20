import { useCallback } from "react";
import { useSetAtom } from "jotai";
import { useLingui } from "@lingui/react";
import { msg } from "@lingui/core/macro";

import { openSidePanelAtom } from "@/infrastructure/state";
import { CalendarMonth, type CalendarDayData } from "@/modules/shared/components";
import type { ViewType } from "@/modules/shared/components";
import type { CalendarEmployeeDay } from "@/lib/api/attendance";
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
	/** Device serial filter from page context. */
	deviceSns?: string;
	/** Punch status filter from page context. */
	status?: string;
	/** Called when a day cell is clicked. If omitted, defaults to side panel. */
	onDayClick?: (date: string) => void;
};

// ── Component ──────────────────────────────────────────────────────────

/**
 * AttendanceCalendarView — monthly attendance calendar.
 *
 * Data comes from the `/api/attendance/calendar` backend endpoint
 * which returns pre-computed per-employee-per-day status and hours.
 */
export function AttendanceCalendarView({
	year,
	month,
	userPin,
	deviceSns,
	status,
	onDayClick,
}: AttendanceCalendarViewProps) {
	const { _ } = useLingui();
	const openSidePanel = useSetAtom(openSidePanelAtom);

	const {
		isLoading,
		dayStatusMap,
		employeeStatusesByDay,
		goPrev,
		goNext,
		goToday,
		goPrevYear,
		goNextYear,
		year: currentYear,
		month: currentMonth,
	} = useAttendanceCalendar({ year, month, userPin, deviceSns, status });

	// ── Derive CalendarEmployeeDay[] for each day from employeeStatusesByDay + dayStatusMap ──
	// Used only when opening the detail panel — we need CalendarEmployeeDay[] with full fields.
	// We don't store the full data per-day here; instead we pass the status entries.
	// The DayDetailPanel takes CalendarEmployeeDay[], which we approximate from status entries.

	const handleDayClick = useCallback(
		(day: CalendarDayData) => {
			if (onDayClick) {
				onDayClick(day.date);
				return;
			}
			const entries = employeeStatusesByDay.get(day.date) ?? [];
			// Convert EmployeeStatusEntry[] → CalendarEmployeeDay[] for the detail panel
			const employees: CalendarEmployeeDay[] = entries.map((e) => ({
				pin: e.pin,
				name: e.name,
				status: e.status,
				hours: e.hours ?? 0,
				overtime_hours: 0,
				break_minutes: 0,
				anomaly_count: 0,
				is_late: e.status === "late",
			}));
			openSidePanel({
				title: day.date,
				render: () => <DayDetailPanel day={day} employees={employees} />,
			});
		},
		[onDayClick, employeeStatusesByDay, openSidePanel],
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
				isLoading={isLoading}
				renderDayContent={
					!userPin
						? (day) => {
								const statuses = employeeStatusesByDay.get(day.date);
								return statuses && statuses.length > 0 ? (
									<MiniStatusBars statuses={statuses} />
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

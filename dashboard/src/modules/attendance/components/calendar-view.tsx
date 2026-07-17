import { useCallback } from "react";
import { useSetAtom } from "jotai";
import { useLingui } from "@lingui/react";
import { msg } from "@lingui/core/macro";

import { openSidePanelAtom } from "@/infrastructure/state";
import { CalendarMonth, type CalendarDayData } from "@/modules/shared/components";
import type { ViewType } from "@/modules/shared/components";
import type { Punch } from "@/lib/api/punches";
import { Heading, Text, ListItem } from "@/components/ui";
import { useAttendanceCalendar } from "../hooks/use-attendance-calendar";
import { CalendarToolbar } from "./calendar-toolbar";
import styles from "./calendar-view.module.scss";

// ── Types ──────────────────────────────────────────────────────────────

export type AttendanceCalendarViewProps = {
	year: number;
	month: number;
	/** Optional: filter to a single employee PIN. */
	userPin?: string;
	/** Called when a day cell is clicked. If omitted, defaults to side panel. */
	onDayClick?: (date: string) => void;
};

// ── Side Panel: Day Detail ─────────────────────────────────────────────

function DayDetailPanel({ day, punches }: { day: CalendarDayData; punches: Punch[] }) {
	const { _ } = useLingui();
	const date = new Date(day.date + "T00:00:00");
	const title = date.toLocaleDateString(undefined, {
		weekday: "long",
		year: "numeric",
		month: "long",
		day: "numeric",
	});

	if (punches.length === 0) {
		return (
			<>
				<Heading level="h3">{title}</Heading>
				<Text variant="body" color="tertiary">
					{_(msg`No punch records for this day.`)}
				</Text>
			</>
		);
	}

	return (
		<>
			<Heading level="h3">{title}</Heading>
			{punches.map((p) => (
				<ListItem key={p.id}>
					<ListItem.Leading>
						<Text variant="body" weight="medium">
							{new Date(p.timestamp * 1000).toLocaleTimeString()}
						</Text>
						<Text variant="caption" color="secondary">
							{p.status.replace(/_/g, " ")}
						</Text>
					</ListItem.Leading>
					<ListItem.Trailing>
						<Text variant="caption" color="tertiary">
							{p.employee_name ?? p.user_pin}
						</Text>
					</ListItem.Trailing>
				</ListItem>
			))}
		</>
	);
}

// ── Component ──────────────────────────────────────────────────────────

/**
 * AttendanceCalendarView — monthly attendance calendar.
 *
 * Supports two modes:
 * - **All Employees**: aggregates punches across all employees per day
 * - **Single Employee** (via `userPin`): classifies one employee's punches
 *
 * Data fetching and day status computation delegated to {@link useAttendanceCalendar}.
 * Includes month navigation via {@link CalendarToolbar}.
 * Day clicks open a side panel showing that day's punch records.
 */
export function AttendanceCalendarView({ year, month, userPin, onDayClick }: AttendanceCalendarViewProps) {
	const { _ } = useLingui();
	const openSidePanel = useSetAtom(openSidePanelAtom);

	// Delegate all data handling to the hook (controlled mode)
	const {
		punchesByDay,
		dayStatusMap,
		goPrev,
		goNext,
		goToday,
	} = useAttendanceCalendar({ year, month, userPin });

	// ── Day click handler ───────────────────────────────────────────
	const handleDayClick = useCallback((day: CalendarDayData) => {
		if (onDayClick) {
			onDayClick(day.date);
			return;
		}
		const punches = punchesByDay.get(day.date) ?? [];
		openSidePanel({
			title: day.date,
			render: () => <DayDetailPanel day={day} punches={punches} />,
		});
	}, [onDayClick, punchesByDay, openSidePanel]);

	return (
		<div>
			<CalendarToolbar
				year={year}
				month={month}
				onPrev={goPrev}
				onNext={goNext}
				onToday={goToday}
			/>
			<CalendarMonth
				year={year}
				month={month}
				dayStatus={dayStatusMap}
				onDayClick={handleDayClick}
				weekStartsOn={1}
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

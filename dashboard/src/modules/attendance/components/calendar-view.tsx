import { useMemo } from "react";
import { useLingui } from "@lingui/react";
import { msg } from "@lingui/core/macro";

import { CalendarMonth, type CalendarDayStatus } from "@/modules/shared/components";
import { usePunchData } from "@/modules/punches/hooks/use-punch-data";
import type { ViewType } from "@/modules/shared/components";
import { classifyDayFromPunches } from "../compute";
import styles from "./calendar-view.module.scss";

// ── Types ──────────────────────────────────────────────────────────────

type AttendanceCalendarViewProps = {
	year: number;
	month: number;
	/** Called when a day cell is clicked. */
	onDayClick?: (date: string) => void;
};

// ── Component ──────────────────────────────────────────────────────────

/**
 * AttendanceCalendarView — monthly attendance calendar for all employees.
 *
 * Fetches all punches for the given month via {@link usePunchData},
 * aggregates them by date, and renders a {@link CalendarMonth} with
 * color-coded day cells classified by {@link classifyDayFromPunches}.
 *
 * Rendered by {@link DataListView} via `renderCustomView` when the user
 * selects "Calendar" from the ViewPicker.
 */
export function AttendanceCalendarView({ year, month, onDayClick }: AttendanceCalendarViewProps) {
	const { _ } = useLingui();

	const since = useMemo(() => {
		const d = new Date(year, month - 1, 1);
		return d.toISOString().split("T")[0];
	}, [year, month]);

	const until = useMemo(() => {
		const d = new Date(year, month, 0);
		return d.toISOString().split("T")[0];
	}, [year, month]);

	const { data, isLoading } = usePunchData({
		since,
		until,
		limit: 10000,
	});

	/**
	 * Aggregate punches by date, then classify each day.
	 * Map: ISO date → { status, hours }
	 */
	const dayStatus = useMemo<Record<string, { status: CalendarDayStatus; hours: number | null }>>(() => {
		const byDay = new Map<string, typeof data.punches>();
		for (const p of data?.punches ?? []) {
			const dateKey = new Date(p.timestamp * 1000).toISOString().split("T")[0];
			const existing = byDay.get(dateKey) ?? [];
			existing.push(p);
			byDay.set(dateKey, existing);
		}

		const result: Record<string, { status: CalendarDayStatus; hours: number | null }> = {};
		for (const [dateKey, punches] of byDay) {
			result[dateKey] = classifyDayFromPunches(punches);
		}
		return result;
	}, [data]);

	return (
		<CalendarMonth
			year={year}
			month={month}
			dayStatus={dayStatus}
			isLoading={isLoading}
			onDayClick={onDayClick ? (day) => onDayClick(day.date) : undefined}
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
	);
}

/**
 * Export a factory that creates the renderCustomView callback for DataListView.
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

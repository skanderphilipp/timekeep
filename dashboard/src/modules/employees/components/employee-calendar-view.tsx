import { useMemo } from "react";
import { useLingui } from "@lingui/react";
import { msg } from "@lingui/core/macro";

import { CalendarMonth, type CalendarDayStatus } from "@/modules/shared/components";
import { usePunchData } from "@/modules/punches/hooks/use-punch-data";
import type { ViewType } from "@/modules/shared/components";
import styles from "./employee-calendar-view.module.scss";

// ── Types ──────────────────────────────────────────────────────────────

type EmployeeCalendarViewProps = {
	year: number;
	month: number;
	/** Called when a day cell is clicked. */
	onDayClick?: (date: string) => void;
};

// ── Component ──────────────────────────────────────────────────────────

/**
 * EmployeeCalendarView — monthly attendance calendar for all employees.
 *
 * Fetches all punches for the given month via {@link usePunchData},
 * aggregates them by date, and renders a {@link CalendarMonth} with
 * color-coded day cells:
 * - **full** (green): at least one employee punched that day
 * - **absent** (gray): weekday with no punches
 * - **weekend** (muted): Saturday or Sunday
 *
 * Rendered by {@link DataListView} via `renderCustomView` when the user
 * selects "Calendar" from the ViewPicker.
 */
export function EmployeeCalendarView({ year, month, onDayClick }: EmployeeCalendarViewProps) {
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
	 * Aggregate punches by date.
	 * Map: ISO date → { count: number of unique employees }
	 */
	const dayStatus = useMemo<Record<string, { status: CalendarDayStatus; hours?: number | null }>>(() => {
		const map = new Map<string, Set<string>>();
		for (const p of data?.punches ?? []) {
			const dateKey = new Date(p.timestamp * 1000).toISOString().split("T")[0];
			if (!map.has(dateKey)) {
				map.set(dateKey, new Set());
			}
			map.get(dateKey)!.add(p.user_pin);
		}

		const result: Record<string, { status: CalendarDayStatus; hours?: number | null }> = {};
		for (const [dateKey, employees] of map) {
			result[dateKey] = {
				status: employees.size > 0 ? "full" : "absent",
				hours: employees.size,
			};
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
			return <EmployeeCalendarView year={year} month={month} onDayClick={onDayClick} />;
		}
		return null;
	};
}

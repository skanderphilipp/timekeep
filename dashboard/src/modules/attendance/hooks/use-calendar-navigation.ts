import { useState, useCallback, useEffect, useRef } from "react";

/**
 * Calendar month navigation hook.
 *
 * Supports two modes:
 * - **Controlled**: pass `year`/`month`. Syncs externally via useEffect.
 *   Navigation (goPrev/goNext) uses functional setState, avoiding stale closures.
 *   Bug 5 fix: ref guard prevents unnecessary re-syncs when props re-render
 *   with the same values after internal navigation.
 * - **Uncontrolled**: internal state with prev/next/today navigation.
 *
 * Extracted from use-attendance-calendar.ts.
 * Twenty pattern: navigation is a separate concern from data fetching.
 */
export function useCalendarNavigation(
	options: {
		/** External year control (controlled mode). */
		year?: number;
		/** External month control (controlled mode). */
		month?: number;
	} = {},
) {
	const isControlled = options.year != null && options.month != null;
	const today = new Date();
	const initialYear = options.year ?? today.getFullYear();
	const initialMonth = options.month ?? today.getMonth() + 1;

	const [year, setYear] = useState(initialYear);
	const [month, setMonth] = useState(initialMonth);

	/**
	 * Track the last external props we synced FROM.
	 * Bug 5 fix: prevents re-syncing when parent re-renders with the same
	 * year/month after internal navigation has moved to a different month.
	 */
	const lastExternalRef = useRef({ year: options.year, month: options.month });

	// Sync when external year/month change to NEW values (not same-as-before).
	useEffect(() => {
		if (!isControlled) return;
		const prevYear = lastExternalRef.current.year;
		const prevMonth = lastExternalRef.current.month;

		// Only sync if parent actually changed the values (not just re-rendered)
		if (options.year !== prevYear || options.month !== prevMonth) {
			lastExternalRef.current = { year: options.year, month: options.month };
			if (options.year != null) setYear(options.year);
			if (options.month != null) setMonth(options.month);
		}
	}, [isControlled, options.year, options.month]);

	const goPrev = useCallback(() => {
		setMonth((m) => {
			if (m === 1) {
				setYear((y) => y - 1);
				return 12;
			}
			return m - 1;
		});
	}, []);

	const goNext = useCallback(() => {
		setMonth((m) => {
			if (m === 12) {
				setYear((y) => y + 1);
				return 1;
			}
			return m + 1;
		});
	}, []);

	const goToday = useCallback(() => {
		const now = new Date();
		setYear(now.getFullYear());
		setMonth(now.getMonth() + 1);
	}, []);

	const goPrevYear = useCallback(() => {
		setYear((y) => y - 1);
	}, []);

	const goNextYear = useCallback(() => {
		setYear((y) => y + 1);
	}, []);

	const monthLabel = new Date(year, month - 1, 1).toLocaleDateString(undefined, {
		year: "numeric",
		month: "long",
	});

	return { year, month, monthLabel, goPrev, goNext, goToday, goPrevYear, goNextYear, isControlled };
}

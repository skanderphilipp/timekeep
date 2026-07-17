import { useState, useCallback, useEffect } from "react";

/**
 * Calendar month navigation hook.
 *
 * Supports two modes:
 * - **Controlled**: pass `year`/`month`. Syncs externally (via useEffect).
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

	// Sync when external year/month change (controlled mode)
	useEffect(() => {
		if (isControlled) {
			setYear(options.year!);
			setMonth(options.month!);
		}
	}, [isControlled, options.year, options.month]);

	const goPrev = useCallback(() => {
		if (month === 1) {
			setYear((y) => y - 1);
			setMonth(12);
		} else {
			setMonth((m) => m - 1);
		}
	}, [month]);

	const goNext = useCallback(() => {
		if (month === 12) {
			setYear((y) => y + 1);
			setMonth(1);
		} else {
			setMonth((m) => m + 1);
		}
	}, [month]);

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

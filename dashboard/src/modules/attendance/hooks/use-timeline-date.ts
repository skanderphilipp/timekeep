import { useState, useCallback, useEffect } from "react";
import { addDays, subDays } from "date-fns";

/**
 * Day navigation state for the daily timeline view.
 *
 * Synchronizes with an external `initialDate` (parent filter) via useEffect
 * on `toDateString()` changes. Exposes prev/next/today callbacks.
 *
 * @example
 * ```ts
 * const { date, goPrev, goNext, goToday } = useTimelineDate(initialDate, onDateChange);
 * ```
 */
export function useTimelineDate(
	initialDate: Date,
	onDateChange?: (date: Date) => void,
) {
	const [date, setDate] = useState(initialDate);

	const goPrev = useCallback(() => {
		setDate((prev) => {
			const next = subDays(prev, 1);
			onDateChange?.(next);
			return next;
		});
	}, [onDateChange]);

	const goNext = useCallback(() => {
		setDate((prev) => {
			const next = addDays(prev, 1);
			onDateChange?.(next);
			return next;
		});
	}, [onDateChange]);

	const goToday = useCallback(() => {
		const today = new Date();
		setDate(today);
		onDateChange?.(today);
	}, [onDateChange]);

	// Sync when parent changes the date externally
	useEffect(() => {
		setDate(initialDate);
	}, [initialDate.toDateString()]);

	return { date, goPrev, goNext, goToday };
}

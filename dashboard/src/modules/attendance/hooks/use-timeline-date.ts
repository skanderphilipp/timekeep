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
		const prev = subDays(date, 1);
		setDate(prev);
		onDateChange?.(prev);
	}, [date, onDateChange]);

	const goNext = useCallback(() => {
		const next = addDays(date, 1);
		setDate(next);
		onDateChange?.(next);
	}, [date, onDateChange]);

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

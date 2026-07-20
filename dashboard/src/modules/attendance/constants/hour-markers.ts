/**
 * Pre-computed hour marker labels for the 24-hour timeline.
 *
 * Extracted from the monolithic timeline-view.tsx inline useMemo.
 * Pattern: constants live in their own file, not inside components.
 */
export const HOUR_MARKERS: string[] = Array.from({ length: 24 }, (_, h) =>
	`${String(h).padStart(2, "0")}:00`,
);

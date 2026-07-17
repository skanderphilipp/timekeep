import { clsx } from "clsx";

import type { CalendarDayStatus } from "@/modules/shared/components";

import styles from "./mini-status-bars.module.scss";

// ── Types ──────────────────────────────────────────────────────────────────────

export type EmployeeStatusEntry = {
	pin: string;
	name: string;
	status: CalendarDayStatus;
};

export type MiniStatusBarsProps = {
	/** Per-employee status entries for this day. */
	statuses: EmployeeStatusEntry[];
	/** Maximum number of bars to render before showing overflow count. */
	maxBars?: number;
	/** Compact mode — fewer bars, smaller overflow. */
	compact?: boolean;
};

// ── Status → bar color ─────────────────────────────────────────────────────────

const BAR_COLOR: Record<CalendarDayStatus, string> = {
	full: styles.barFull,
	half: styles.barHalf,
	late: styles.barLate,
	absent: styles.barAbsent,
	weekend: styles.barWeekend,
};

// ── Component ──────────────────────────────────────────────────────────────────

/**
 * Mini status bars rendered inside a calendar day cell.
 *
 * Each bar represents one employee's attendance status for that day.
 * Max visible bars = 8 (configurable via `maxBars`). If there are more
 * employees, a "+N" overflow indicator is shown.
 *
 * Used as the `renderDayContent` prop of {@link CalendarMonth}.
 */
export function MiniStatusBars({
	statuses,
	maxBars = 8,
	compact = false,
}: MiniStatusBarsProps) {
	if (!statuses || statuses.length === 0) return null;

	const effectiveMax = compact ? 4 : maxBars;
	const visible = statuses.slice(0, effectiveMax);
	const overflow = statuses.length - effectiveMax;

	return (
		<div data-slot="mini-status-bars" className={clsx(styles.container, compact && styles.compact)}>
			{visible.map((emp) => (
				<span
					key={emp.pin}
					data-slot="mini-status-bar"
					data-status={emp.status}
					className={clsx(styles.bar, BAR_COLOR[emp.status])}
					title={`${emp.name}: ${emp.status}`}
				/>
			))}
			{overflow > 0 && (
				<span data-slot="mini-status-overflow" className={styles.overflow}>
					+{overflow}
				</span>
			)}
		</div>
	);
}

MiniStatusBars.displayName = "MiniStatusBars";

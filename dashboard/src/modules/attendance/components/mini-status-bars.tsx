import { clsx } from "clsx";
import { msg } from "@lingui/core/macro";
import { useLingui } from "@lingui/react";

import type { CalendarDayStatus } from "@/modules/shared/components";

import styles from "./mini-status-bars.module.scss";

// ── Types ──────────────────────────────────────────────────────────────────────

export type EmployeeStatusEntry = {
	pin: string;
	name: string;
	status: CalendarDayStatus;
	/** Hours worked. Shown alongside status for additional context. */
	hours?: number | null;
};

export type MiniStatusBarsProps = {
	/** Per-employee status entries for this day. */
	statuses: EmployeeStatusEntry[];
};

// ── Status formatting ──────────────────────────────────────────────────────────

const STATUS_LABEL: Record<CalendarDayStatus, ReturnType<typeof msg>> = {
	full: msg`Full`,
	half: msg`Half`,
	late: msg`Late`,
	absent: msg`Absent`,
	weekend: msg`Off`,
};

function formatHoursCompact(hours: number): string {
	if (hours >= 1) return `${hours.toFixed(1)}h`;
	return `${Math.round(hours * 60)}m`;
}

// ── Component ──────────────────────────────────────────────────────────────────

/**
 * Scrollable employee status list rendered inside a calendar day cell.
 *
 * Shows status dot, employee name, and hours for every employee —
 * present, late, half, and absent. The list scrolls vertically when
 * content exceeds the cell height.
 *
 * Used as the `renderDayContent` prop of {@link CalendarMonth} in
 * "All Employees" mode.
 */
export function MiniStatusBars({
	statuses,
}: MiniStatusBarsProps) {
	const { _ } = useLingui();

	if (!statuses || statuses.length === 0) return null;

	return (
		<div data-slot="mini-status-bars" className={styles.container}>
			{statuses.map((emp) => (
				<div
					key={emp.pin}
					data-slot="employee-row"
					data-status={emp.status}
					className={styles.row}
					title={`${emp.name}: ${_(STATUS_LABEL[emp.status])}${emp.hours != null ? ` (${formatHoursCompact(emp.hours)})` : ""}`}
				>
					<span
						className={clsx(styles.statusDot, styles[`dot${capitalize(emp.status)}`])}
					/>
					<span className={styles.employeeName}>{emp.name}</span>
					{emp.hours != null && (
						<span className={styles.hours}>{formatHoursCompact(emp.hours)}</span>
					)}
				</div>
			))}
		</div>
	);
}

MiniStatusBars.displayName = "MiniStatusBars";

// ── Helpers ────────────────────────────────────────────────────────────────────

function capitalize(s: string): string {
	return s.charAt(0).toUpperCase() + s.slice(1);
}

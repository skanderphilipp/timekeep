import { useMemo } from "react";
import { useLingui } from "@lingui/react";
import { msg } from "@lingui/core/macro";

import { Heading, Text, Tag, Separator } from "@/components/ui";
import type { CalendarDayData } from "@/modules/shared/components";
import type { CalendarEmployeeDay } from "@/lib/api/attendance";

import styles from "./day-detail-panel.module.scss";

// ── Types ──────────────────────────────────────────────────────────────────────

export type DayDetailPanelProps = {
	day: CalendarDayData;
	/** Per-employee summaries for this day (from calendar endpoint). */
	employees: CalendarEmployeeDay[];
};

// ── Sub-component: EmployeeGroup ────────────────────────────────────────────────

function EmployeeGroup({ employee }: { employee: CalendarEmployeeDay }) {
	const { _ } = useLingui();

	return (
		<section data-slot="employee-group" className={styles.employeeGroup}>
			{/* Employee header */}
			<section data-slot="employee-header" className={styles.employeeHeader}>
				<Text variant="body" weight="medium">
					{employee.name || employee.pin}
				</Text>
				<Text variant="caption" color="tertiary">
					{employee.pin}
				</Text>
			</section>

			{/* Attendance stats */}
			<section data-slot="stat-row" className={styles.statRow}>
				<StatChip label={_(msg`Status`)} value={employee.status} />
				{employee.hours > 0 && (
					<StatChip label={_(msg`Hours`)} value={`${employee.hours.toFixed(1)}h`} />
				)}
				{employee.overtime_hours > 0 && (
					<StatChip label={_(msg`Overtime`)} value={`${employee.overtime_hours.toFixed(1)}h`} />
				)}
				{employee.break_minutes > 0 && (
					<StatChip label={_(msg`Break`)} value={`${employee.break_minutes}m`} />
				)}
				{employee.anomaly_count > 0 && (
					<Tag
						text={_(msg`${employee.anomaly_count} anomalies`)}
						color="amber"
						variant="solid"
						weight="medium"
					/>
				)}
			</section>
		</section>
	);
}

// ── Sub-component: StatChip ─────────────────────────────────────────────────────

function StatChip({ label, value }: { label: string; value: string }) {
	return (
		<section data-slot="stat-chip" className={styles.statChip}>
			<Text variant="caption" color="secondary">
				{label}
			</Text>
			<Text variant="body" weight="medium">
				{value}
			</Text>
		</section>
	);
}

// ── Component ───────────────────────────────────────────────────────────────────

/**
 * Side panel content showing attendance data for a single calendar day,
 * grouped by employee with computed summaries from the backend.
 *
 * Data comes from the `/api/attendance/calendar` endpoint — no raw punches
 * are fetched. For individual punch events, a separate detail query should
 * be added in a follow-up.
 */
export function DayDetailPanel({ day, employees }: DayDetailPanelProps) {
	const { _ } = useLingui();
	const date = new Date(day.date + "T00:00:00");
	const title = date.toLocaleDateString(undefined, {
		weekday: "long",
		year: "numeric",
		month: "long",
		day: "numeric",
	});

	// Sort: not-absent first, then absent, alphabetically within each
	// Called unconditionally to satisfy rules-of-hooks
	const sorted = useMemo(() => {
		const list = employees ?? [];
		return [...list].sort((a, b) => {
			if (a.status === "absent" && b.status !== "absent") return 1;
			if (a.status !== "absent" && b.status === "absent") return -1;
			return (a.name || a.pin).localeCompare(b.name || b.pin);
		});
	}, [employees]);

	if (!employees || employees.length === 0) {
		return (
			<>
				<Heading level="h3">{title}</Heading>
				<Text variant="body" color="tertiary">
					{_(msg`No attendance records for this day.`)}
				</Text>
			</>
		);
	}

	return (
		<>
			<Heading level="h3" className={styles.title}>
				{title}
			</Heading>
			{sorted.map((emp, index) => (
				<section key={emp.pin}>
					{index > 0 && (
						<section className={styles.separatorWrapper}>
							<Separator />
						</section>
					)}
					<EmployeeGroup employee={emp} />
				</section>
			))}
		</>
	);
}

import { useMemo } from "react";
import { useLingui } from "@lingui/react";
import { msg } from "@lingui/core/macro";

import { Heading, Text, Tag, Separator } from "@/components/ui";
import type { CalendarDayData } from "@/modules/shared/components";
import type { CalendarEmployeeDay } from "@/lib/api/attendance";

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
		<div style={{ marginBottom: "var(--ao-spacing-4)" }}>
			{/* Employee header */}
			<div
				style={{
					display: "flex",
					alignItems: "baseline",
					gap: "var(--ao-spacing-2)",
					marginBottom: "var(--ao-spacing-1)",
				}}
			>
				<Text variant="body" weight="medium">
					{employee.name || employee.pin}
				</Text>
				<Text variant="caption" color="tertiary">
					{employee.pin}
				</Text>
			</div>

			{/* Attendance stats */}
			<div
				style={{
					display: "flex",
					flexWrap: "wrap",
					gap: "var(--ao-spacing-3)",
				}}
			>
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
			</div>
		</div>
	);
}

// ── Sub-component: StatChip ─────────────────────────────────────────────────────

function StatChip({ label, value }: { label: string; value: string }) {
	return (
		<div
			style={{
				display: "flex",
				alignItems: "center",
				gap: "var(--ao-spacing-1)",
			}}
		>
			<Text variant="caption" color="secondary">
				{label}
			</Text>
			<Text variant="body" weight="medium">
				{value}
			</Text>
		</div>
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

	// Sort: not-absent first, then absent, alphabetically within each
	const sorted = useMemo(() => {
		return [...employees].sort((a, b) => {
			if (a.status === "absent" && b.status !== "absent") return 1;
			if (a.status !== "absent" && b.status === "absent") return -1;
			return (a.name || a.pin).localeCompare(b.name || b.pin);
		});
	}, [employees]);

	return (
		<>
			<Heading level="h3" style={{ marginBottom: "var(--ao-spacing-4)" }}>
				{title}
			</Heading>
			{sorted.map((emp, index) => (
				<div key={emp.pin}>
					{index > 0 && (
						<div style={{ marginBottom: "var(--ao-spacing-3)" }}>
							<Separator />
						</div>
					)}
					<EmployeeGroup employee={emp} />
				</div>
			))}
		</>
	);
}

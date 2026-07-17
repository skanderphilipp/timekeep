import { useMemo, type ReactNode } from "react";
import { useSetAtom } from "jotai";
import { msg } from "@lingui/core/macro";
import { useLingui } from "@lingui/react";

import { openSidePanelAtom } from "@/infrastructure/state";
import { usePunchData, type Punch } from "@/modules/punches/hooks/use-punch-data";
import { Text, Heading, ListItem, Tag } from "@/components/ui";
import { Timeline, type TimelineRowData } from "@/modules/shared/components";
import {
	buildBlocks,
	buildLegendItems,
	computeAttendanceSummary,
	formatDuration,
} from "../compute";

// ── Types ──────────────────────────────────────────────────────────────────────

export type TimelineEmployee = {
	pin: string;
	name: string;
};

export type TimelineViewProps = {
	date: Date;
	/** Optional: explicit date range from parent filters (syncs timeline with active filters). */
	filterSince?: string;
	filterUntil?: string;
	employees?: TimelineEmployee[];
	className?: string;
};

// ── Side Panel: Aggregated Attendance Summary ───────────────────────────────────

function EmployeeAttendanceSummary({
	employee,
	punches,
}: {
	employee: TimelineEmployee;
	punches: Punch[];
}) {
	const { _ } = useLingui();
	const summary = useMemo(() => computeAttendanceSummary(punches), [punches]);

	if (punches.length === 0) {
		return (
			<>
				<Heading level="h3">
					{employee.name} ({employee.pin})
				</Heading>
				<Text variant="body" color="tertiary">
					{_(msg`No records for this day.`)}
				</Text>
			</>
		);
	}

	return (
		<>
			<Heading level="h3">
				{employee.name} ({employee.pin})
			</Heading>

			{/* Summary stats */}
			<div style={{ display: "flex", flexDirection: "column", gap: "var(--ao-spacing-2)", marginTop: "var(--ao-spacing-3)" }}>
				<SummaryRow
					label={_(msg`Present`)}
					value={formatDuration(summary.presentMinutes)}
				/>
				<SummaryRow
					label={_(msg`Break`)}
					value={formatDuration(summary.breakMinutes)}
				/>
				{summary.overtimeMinutes > 0 && (
					<SummaryRow
						label={_(msg`Overtime`)}
						value={formatDuration(summary.overtimeMinutes)}
					/>
				)}
				{summary.anomalyCount > 0 && (
					<SummaryRow
						label={_(msg`Anomalies`)}
						value={
							<Tag text={String(summary.anomalyCount)} color="amber" variant="solid" weight="medium" />
						}
					/>
				)}
			</div>

			{/* Event timeline */}
			<Text variant="caption" color="secondary" style={{ marginTop: "var(--ao-spacing-4)", marginBottom: "var(--ao-spacing-1)" }}>
				{_(msg`Punch Log`)}
			</Text>
			{summary.events.map((event) => (
				<ListItem key={`${event.timestamp}-${event.status}`}>
					<ListItem.Leading>
						<Text variant="body" weight="medium">
							{event.time}
						</Text>
						<Text variant="caption" color="secondary">
							{event.status.replace(/_/g, " ")}
						</Text>
					</ListItem.Leading>
					<ListItem.Trailing>
						{event.isAnomaly && (
							<Tag text={_(msg`Anomaly`)} color="amber" variant="solid" weight="medium" />
						)}
					</ListItem.Trailing>
				</ListItem>
			))}
		</>
	);
}

function SummaryRow({
	label,
	value,
}: {
	label: string;
	value: ReactNode;
}) {
	return (
		<div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
			<Text variant="body" color="secondary">
				{label}
			</Text>
			{typeof value === "string" ? (
				<Text variant="body" weight="medium">
					{value}
				</Text>
			) : (
				value
			)}
		</div>
	);
}

// ── Component ──────────────────────────────────────────────────────────────────

/**
 * AttendanceTimelineView — daily timeline visualization for attendance.
 *
 * Fetches punches for a date range, groups by employee, and renders
 * a {@link Timeline} with colored presence/break/overtime blocks.
 * Clicking an employee row opens a side panel with an aggregated
 * attendance summary computed by {@link computeAttendanceSummary}.
 */
export function AttendanceTimelineView({ date, filterSince, filterUntil, employees, className }: TimelineViewProps) {
	const { _ } = useLingui();
	const openSidePanel = useSetAtom(openSidePanelAtom);

	// Use explicit filter range when provided (syncs with parent page filters).
	const since = useMemo(
		() => filterSince ?? date.toISOString().split("T")[0],
		[date, filterSince],
	);
	const until = useMemo(
		() => filterUntil ?? (() => {
			const next = new Date(date);
			next.setDate(next.getDate() + 1);
			return next.toISOString().split("T")[0];
		})(),
		[date, filterUntil],
	);

	const { data, isLoading } = usePunchData({
		since,
		until,
		limit: 5000,
	});

	const punchesByEmployee = useMemo(() => {
		const map = new Map<string, Punch[]>();
		data?.punches.forEach((p) => {
			const existing = map.get(p.user_pin) ?? [];
			existing.push(p);
			map.set(p.user_pin, existing);
		});
		return map;
	}, [data]);

	const employeeList: TimelineEmployee[] = useMemo(() => {
		if (employees && employees.length > 0) return employees;
		const seen = new Set<string>();
		const list: TimelineEmployee[] = [];
		data?.punches.forEach((p) => {
			if (!seen.has(p.user_pin)) {
				seen.add(p.user_pin);
				list.push({ pin: p.user_pin, name: p.employee_name ?? p.user_pin });
			}
		});
		return list;
	}, [data, employees]);

	const hourMarkers = useMemo(() => {
		const markers: string[] = [];
		for (let h = 0; h < 24; h++) {
			markers.push(`${String(h).padStart(2, "0")}:00`);
		}
		return markers;
	}, []);

	const translate = useMemo(() => (key: string) => key, []);

	const rows: TimelineRowData[] = useMemo(
		() =>
			employeeList.map((emp) => {
				const punches = punchesByEmployee.get(emp.pin) ?? [];
				return {
					id: emp.pin,
					name: emp.name,
					subLabel: emp.pin,
					blocks: buildBlocks(punches, translate),
					onClick: () => {
						openSidePanel({
							title: emp.name,
							render: () => <EmployeeAttendanceSummary employee={emp} punches={punches} />,
						});
					},
				};
			}),
		[employeeList, punchesByEmployee, translate, openSidePanel],
	);

	return (
		<Timeline
			headerLabel={_(msg`Employee`)}
			hourMarkers={hourMarkers}
			rows={rows}
			isLoading={isLoading}
			legendItems={buildLegendItems(translate)}
			emptyState={_(msg`No punch records for this day.`)}
			className={className}
		/>
	);
}

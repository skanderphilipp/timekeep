import { useMemo, useState, useCallback, useEffect, type ReactNode } from "react";
import { useSetAtom } from "jotai";
import { msg } from "@lingui/core/macro";
import { useLingui } from "@lingui/react";
import { addDays, subDays } from "date-fns";

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
import { TimelineToolbar } from "./timeline-toolbar";

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
	/** Called when the user navigates to a different day. */
	onDateChange?: (date: Date) => void;
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

			<div style={{ display: "flex", flexDirection: "column", gap: "var(--ao-spacing-2)", marginTop: "var(--ao-spacing-3)" }}>
				<SummaryRow label={_(msg`Present`)} value={formatDuration(summary.presentMinutes)} />
				<SummaryRow label={_(msg`Break`)} value={formatDuration(summary.breakMinutes)} />
				{summary.overtimeMinutes > 0 && (
					<SummaryRow label={_(msg`Overtime`)} value={formatDuration(summary.overtimeMinutes)} />
				)}
				{summary.anomalyCount > 0 && (
					<SummaryRow
						label={_(msg`Anomalies`)}
						value={<Tag text={String(summary.anomalyCount)} color="amber" variant="solid" weight="medium" />}
					/>
				)}
			</div>

			<Text variant="caption" color="secondary" style={{ marginTop: "var(--ao-spacing-4)", marginBottom: "var(--ao-spacing-1)" }}>
				{_(msg`Punch Log`)}
			</Text>
			{summary.events.map((event) => (
				<ListItem key={`${event.timestamp}-${event.status}`}>
					<ListItem.Leading>
						<Text variant="body" weight="medium">{event.time}</Text>
						<Text variant="caption" color="secondary">{event.status.replace(/_/g, " ")}</Text>
					</ListItem.Leading>
					<ListItem.Trailing>
						{event.isAnomaly && <Tag text={_(msg`Anomaly`)} color="amber" variant="solid" weight="medium" />}
					</ListItem.Trailing>
				</ListItem>
			))}
		</>
	);
}

function SummaryRow({ label, value }: { label: string; value: ReactNode }) {
	return (
		<div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
			<Text variant="body" color="secondary">{label}</Text>
			{typeof value === "string" ? <Text variant="body" weight="medium">{value}</Text> : value}
		</div>
	);
}

// ── Component ──────────────────────────────────────────────────────────────────

/**
 * AttendanceTimelineView — daily timeline visualization for attendance.
 *
 * Includes day navigation toolbar (prev/next/today).
 * Clicking an employee row opens a side panel with an aggregated attendance summary.
 */
export function AttendanceTimelineView({
	date: initialDate,
	filterSince,
	filterUntil,
	employees,
	onDateChange,
	className,
}: TimelineViewProps) {
	const { _ } = useLingui();
	const openSidePanel = useSetAtom(openSidePanelAtom);

	// Translate function for compute.ts (keeps compute pure, no Lingui dependency)
	const translate = useMemo(() => (key: string) => {
		const labels: Record<string, string> = {
			"Check In": _(msg`Check In`),
			"Check Out": _(msg`Check Out`),
			"Break In": _(msg`Break In`),
			"Break Out": _(msg`Break Out`),
			"Overtime In": _(msg`Overtime In`),
			"Overtime Out": _(msg`Overtime Out`),
			"Present": _(msg`Present`),
			"Break": _(msg`Break`),
			"Overtime": _(msg`Overtime`),
		};
		return labels[key] ?? key;
	}, [_]);

	// ── Day navigation state ──────────────────────────────────────
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

	// ── Data fetching ────────────────────────────────────────────
	const since = useMemo(
		() => filterSince ?? date.toISOString().split("T")[0],
		[date, filterSince],
	);
	const until = useMemo(
		() => filterUntil ?? (() => {
			const next = addDays(date, 1);
			return next.toISOString().split("T")[0];
		})(),
		[date, filterUntil],
	);

	const { data, isLoading } = usePunchData({ since, until, limit: 5000 });

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
		for (let h = 0; h < 24; h++) markers.push(`${String(h).padStart(2, "0")}:00`);
		return markers;
	}, []);

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
		<div>
			<TimelineToolbar
				date={date}
				onPrev={goPrev}
				onNext={goNext}
				onToday={goToday}
			/>
			<Timeline
				headerLabel={_(msg`Employee`)}
				hourMarkers={hourMarkers}
				rows={rows}
				isLoading={isLoading}
				legendItems={buildLegendItems(translate)}
				emptyState={_(msg`No punch records for this day.`)}
				className={className}
			/>
		</div>
	);
}

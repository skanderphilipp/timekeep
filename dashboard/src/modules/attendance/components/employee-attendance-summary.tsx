import { useMemo, type ReactNode } from "react";
import { msg } from "@lingui/core/macro";
import { useLingui } from "@lingui/react";

import { Text, Heading, ListItem, Tag } from "@/components/ui";
import { computeAttendanceSummary, formatDuration } from "../compute";
import type { Punch } from "@/modules/punches/hooks/use-punch-data";
import type { TimelineEmployee } from "../types";

// ── Types ──────────────────────────────────────────────────────────────────────

export type EmployeeAttendanceSummaryProps = {
	employee: TimelineEmployee;
	punches: Punch[];
};

// ── Sub-component: SummaryRow ───────────────────────────────────────────────────

function SummaryRow({ label, value }: { label: string; value: ReactNode }) {
	return (
		<div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
			<Text variant="body" color="secondary">{label}</Text>
			{typeof value === "string" ? <Text variant="body" weight="medium">{value}</Text> : value}
		</div>
	);
}

// ── Component ───────────────────────────────────────────────────────────────────

/**
 * Aggregated attendance summary for a single employee on a single day.
 *
 * Renders as side panel content when clicking an employee row in the timeline.
 * Extracted from the monolithic timeline-view.tsx.
 */
export function EmployeeAttendanceSummary({
	employee,
	punches,
}: EmployeeAttendanceSummaryProps) {
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

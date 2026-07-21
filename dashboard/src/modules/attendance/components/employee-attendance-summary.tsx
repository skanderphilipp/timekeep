import { useMemo, type ReactNode } from "react";
import { msg } from "@lingui/core/macro";
import { useLingui } from "@lingui/react";

import { Text, Heading, ListItem, Tag } from "@/components/ui";
import { computeAttendanceSummary, formatDuration } from "../compute";
import type { Punch } from "@/modules/punches/hooks/use-punch-data";
import type { TimelineEmployee } from "../types";
import type { TimelineEmployeeBlocks } from "@/lib/api/attendance";

import styles from "./employee-attendance-summary.module.scss";

// ── Types ──────────────────────────────────────────────────────────────────────

export type EmployeeAttendanceSummaryProps = {
	employee: TimelineEmployee;
	/** Raw punches (legacy) — used by old consumers. */
	punches?: Punch[];
	/** Pre-computed summary from timeline endpoint (new). */
	timelineData?: TimelineEmployeeBlocks;
};

// ── Sub-component: SummaryRow ───────────────────────────────────────────────────

function SummaryRow({ label, value }: { label: string; value: ReactNode }) {
	return (
		<section data-slot="summary-row" className={styles.summaryRow}>
			<Text variant="body" color="secondary">{label}</Text>
			{typeof value === "string" ? <Text variant="body" weight="medium">{value}</Text> : value}
		</section>
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
	timelineData,
}: EmployeeAttendanceSummaryProps) {
	const { _ } = useLingui();

	// Use pre-computed data from timeline endpoint if available
	const presentMinutes = timelineData ? Math.round(timelineData.hours * 60) : 0;
	const breakMinutes = timelineData?.break_minutes ?? 0;
	const overtimeMinutes = timelineData ? Math.round(timelineData.overtime_hours * 60) : 0;
	const anomalyCount = timelineData?.anomaly_count ?? 0;

	const legacySummary = useMemo(
		() => (punches ? computeAttendanceSummary(punches) : null),
		[punches],
	);

	const effectivePresent = timelineData ? presentMinutes : (legacySummary?.presentMinutes ?? 0);
	const effectiveBreak = timelineData ? breakMinutes : (legacySummary?.breakMinutes ?? 0);
	const effectiveOvertime = timelineData ? overtimeMinutes : (legacySummary?.overtimeMinutes ?? 0);
	const effectiveAnomalies = timelineData ? anomalyCount : (legacySummary?.anomalyCount ?? 0);
	const events = timelineData ? [] : (legacySummary?.events ?? []);

	const hasData = timelineData || (punches && punches.length > 0);

	if (!hasData) {
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

			<section data-slot="attendance-summary-grid" className={styles.summaryGrid}>
				<SummaryRow label={_(msg`Present`)} value={formatDuration(effectivePresent)} />
				<SummaryRow label={_(msg`Break`)} value={formatDuration(effectiveBreak)} />
				{effectiveOvertime > 0 && (
					<SummaryRow label={_(msg`Overtime`)} value={formatDuration(effectiveOvertime)} />
				)}
				{effectiveAnomalies > 0 && (
					<SummaryRow
						label={_(msg`Anomalies`)}
						value={<Tag text={String(effectiveAnomalies)} color="amber" variant="solid" weight="medium" />}
					/>
				)}
			</section>

			{events.length > 0 && (
				<>
					<Text variant="caption" color="secondary" className={styles.punchLogHeader}>
						{_(msg`Punch Log`)}
					</Text>
					{events.map((event) => (
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
			)}
		</>
	);
}

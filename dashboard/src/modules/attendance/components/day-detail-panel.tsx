import { useLingui } from "@lingui/react";
import { msg } from "@lingui/core/macro";

import { Heading, Text, ListItem } from "@/components/ui";
import type { CalendarDayData } from "@/modules/shared/components";
import type { Punch } from "@/lib/api/punches";

// ── Types ──────────────────────────────────────────────────────────────────────

export type DayDetailPanelProps = {
	day: CalendarDayData;
	punches: Punch[];
};

// ── Component ──────────────────────────────────────────────────────────────────

/**
 * Side panel content showing punch records for a single calendar day.
 *
 * Extracted from the monolithic calendar-view.tsx.
 * Twenty pattern: side panel render functions are separate components.
 */
export function DayDetailPanel({ day, punches }: DayDetailPanelProps) {
	const { _ } = useLingui();
	const date = new Date(day.date + "T00:00:00");
	const title = date.toLocaleDateString(undefined, {
		weekday: "long",
		year: "numeric",
		month: "long",
		day: "numeric",
	});

	if (punches.length === 0) {
		return (
			<>
				<Heading level="h3">{title}</Heading>
				<Text variant="body" color="tertiary">
					{_(msg`No punch records for this day.`)}
				</Text>
			</>
		);
	}

	return (
		<>
			<Heading level="h3">{title}</Heading>
			{punches.map((p) => (
				<ListItem key={p.id}>
					<ListItem.Leading>
						<Text variant="body" weight="medium">
							{new Date(p.timestamp * 1000).toLocaleTimeString()}
						</Text>
						<Text variant="caption" color="secondary">
							{p.status.replace(/_/g, " ")}
						</Text>
					</ListItem.Leading>
					<ListItem.Trailing>
						<Text variant="caption" color="tertiary">
							{p.employee_name ?? p.user_pin}
						</Text>
					</ListItem.Trailing>
				</ListItem>
			))}
		</>
	);
}

import { IconChevronLeft, IconChevronRight } from "@tabler/icons-react";
import { msg } from "@lingui/core/macro";
import { useLingui } from "@lingui/react";
import { format } from "date-fns";

import { IconButton, Button, Text, ActionGroup } from "@/components/ui";

import styles from "./timeline-toolbar.module.scss";

// ── Types ──────────────────────────────────────────────────────────────────────

export type TimelineToolbarProps = {
	date: Date;
	onPrev: () => void;
	onNext: () => void;
	onToday: () => void;
};

// ── Component ──────────────────────────────────────────────────────────────────

/**
 * TimelineToolbar — day navigation bar for the daily timeline view.
 *
 * Renders prev / date / next / today buttons.
 * The date is formatted as "Thursday, Jul 17, 2026".
 */
export function TimelineToolbar({
	date,
	onPrev,
	onNext,
	onToday,
}: TimelineToolbarProps) {
	const { _ } = useLingui();
	const dateLabel = format(date, "EEEE, MMM d, yyyy");

	return (
		<nav data-slot="timeline-toolbar" className={styles.toolbar}>
			<ActionGroup>
				<IconButton onClick={onPrev} aria-label={_(msg`Previous day`)} size="sm">
					<IconChevronLeft size={16} />
				</IconButton>
				<Button variant="ghost" size="sm" onClick={onToday}>
					<Text variant="body" weight="medium">
						{dateLabel}
					</Text>
				</Button>
				<IconButton onClick={onNext} aria-label={_(msg`Next day`)} size="sm">
					<IconChevronRight size={16} />
				</IconButton>
			</ActionGroup>
		</nav>
	);
}

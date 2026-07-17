import { IconChevronLeft, IconChevronRight, IconChevronsLeft, IconChevronsRight } from "@tabler/icons-react";
import { msg } from "@lingui/core/macro";
import { useLingui } from "@lingui/react";
import { format } from "date-fns";

import { IconButton, Button, Text, ActionGroup } from "@/components/ui";

import styles from "./calendar-toolbar.module.scss";

// ── Types ──────────────────────────────────────────────────────────────────────

export type CalendarToolbarProps = {
	year: number;
	month: number;
	onPrev: () => void;
	onNext: () => void;
	onToday: () => void;
	/** Year-level prev/next (optional — used for quick year traversal). */
	onPrevYear?: () => void;
	onNextYear?: () => void;
	/** Optional employee filter — rendered as a right-aligned action. */
	employeeSelect?: React.ReactNode;
};

// ── Component ──────────────────────────────────────────────────────────────────

/**
 * CalendarToolbar — month + year navigation bar for calendar views.
 *
 * Renders prev / month-year / next month buttons, optional year jump buttons,
 * and a "Today" action. Accepts an optional `employeeSelect` slot.
 *
 * Layout: [< month] [July 2026] [month >] | [<< year] [year >>] | [employee select]
 */
export function CalendarToolbar({
	year,
	month,
	onPrev,
	onNext,
	onToday,
	onPrevYear,
	onNextYear,
	employeeSelect,
}: CalendarToolbarProps) {
	const { _ } = useLingui();
	const monthLabel = format(new Date(year, month - 1, 1), "MMMM yyyy");
	const hasYearNav = !!onPrevYear && !!onNextYear;

	return (
		<nav data-slot="calendar-toolbar" className={styles.toolbar}>
			<ActionGroup>
				<IconButton onClick={onPrev} aria-label={_(msg`Previous month`)} size="sm">
					<IconChevronLeft size={16} />
				</IconButton>
				<Button variant="ghost" size="sm" onClick={onToday}>
					<Text variant="body" weight="medium">
						{monthLabel}
					</Text>
				</Button>
				<IconButton onClick={onNext} aria-label={_(msg`Next month`)} size="sm">
					<IconChevronRight size={16} />
				</IconButton>
			</ActionGroup>

			{hasYearNav && (
				<ActionGroup>
					<IconButton onClick={onPrevYear} aria-label={_(msg`Previous year`)} size="sm">
						<IconChevronsLeft size={16} />
					</IconButton>
					<Button variant="ghost" size="sm" onClick={onToday}>
						<Text variant="caption" color="secondary">
							{_(msg`Today`)}
						</Text>
					</Button>
					<IconButton onClick={onNextYear} aria-label={_(msg`Next year`)} size="sm">
						<IconChevronsRight size={16} />
					</IconButton>
				</ActionGroup>
			)}

			{employeeSelect && (
				<div className={styles.employeeSlot}>
					{employeeSelect}
				</div>
			)}
		</nav>
	);
}

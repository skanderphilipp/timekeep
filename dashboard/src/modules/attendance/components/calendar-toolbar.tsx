import { IconChevronLeft, IconChevronRight } from "@tabler/icons-react";
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
	/** Optional employee filter — rendered as a right-aligned action. */
	employeeSelect?: React.ReactNode;
};

// ── Component ──────────────────────────────────────────────────────────────────

/**
 * CalendarToolbar — month navigation bar for calendar views.
 *
 * Renders prev / month-year / next / today buttons.
 * Accepts an optional `employeeSelect` slot for per-employee filtering.
 *
 * @example
 * ```tsx
 * <CalendarToolbar
 *   year={2026} month={7}
 *   onPrev={goPrev} onNext={goNext} onToday={goToday}
 *   employeeSelect={<Select ... />}
 * />
 * ```
 */
export function CalendarToolbar({
	year,
	month,
	onPrev,
	onNext,
	onToday,
	employeeSelect,
}: CalendarToolbarProps) {
	const { _ } = useLingui();
	const monthLabel = format(new Date(year, month - 1, 1), "MMMM yyyy");

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

			{employeeSelect && (
				<div className={styles.employeeSlot}>
					{employeeSelect}
				</div>
			)}
		</nav>
	);
}

import { useMemo } from "react";
import { addDays } from "date-fns";

import { usePunchData, type Punch } from "@/modules/punches/hooks/use-punch-data";
import type { PunchFilter } from "@/lib/api";
import { buildBlocks, buildLegendItems } from "../compute";
import type { TimelineRowData } from "@/modules/shared/components";
import type { TimelineEmployee } from "../types";

// ── Types ──────────────────────────────────────────────────────────────────────

export type UsePunchBlocksOptions = {
	/** The selected day. */
	date: Date;
	/** Optional explicit date range overrides (parent filter sync). */
	filterSince?: string;
	filterUntil?: string;
	/**
	 * Additional filter context from parent page (status, device_sns, search, etc.).
	 * Spread into the usePunchData call so timeline data matches page-level filters.
	 */
	filterContext?: Partial<PunchFilter>;
	/** Optional pre-provided employee list (e.g., from parent page). */
	employees?: TimelineEmployee[];
	/** Translation function for buildBlocks / buildLegendItems. */
	translate: (key: string) => string;
};

export type UsePunchBlocksResult = {
	/** Timeline rows ready for the Timeline component. */
	rows: TimelineRowData[];
	/** Legend items (color + translated label). */
	legendItems: Array<{ color: "present" | "warning" | "overtime"; label: string }>;
	/** Loading state. */
	isLoading: boolean;
	/** Raw punches grouped by employee PIN. */
	punchesByEmployee: Map<string, Punch[]>;
	/** Derived employee list (from data if not provided). */
	employeeList: TimelineEmployee[];
};

// ── Hook ──────────────────────────────────────────────────────────────────────

/**
 * Fetches punch data for a given day and transforms it into timeline rows
 * with colored blocks, ready for the shared Timeline component.
 *
 * Extracted from the monolithic timeline-view.tsx.
 * Twenty pattern: data fetching + transformation delegated to a hook.
 */
export function usePunchBlocks({
	date,
	filterSince,
	filterUntil,
	filterContext,
	employees,
	translate,
}: UsePunchBlocksOptions): UsePunchBlocksResult {
	// ── Date range ─────────────────────────────────────────────────
	const since = useMemo(
		() => filterSince ?? date.toISOString().split("T")[0],
		[date, filterSince],
	);
	const until = useMemo(
		() =>
			filterUntil ??
			(() => {
				const next = addDays(date, 1);
				return next.toISOString().split("T")[0];
			})(),
		[date, filterUntil],
	);

	// ── Fetch ──────────────────────────────────────────────────────
	const { data, isLoading } = usePunchData({ since, until, limit: 5000, ...filterContext });

	// ── Group by employee ───────────────────────────────────────────
	const punchesByEmployee = useMemo(() => {
		const map = new Map<string, Punch[]>();
		data?.punches.forEach((p) => {
			const existing = map.get(p.user_pin) ?? [];
			existing.push(p);
			map.set(p.user_pin, existing);
		});
		return map;
	}, [data]);

	// ── Employee list (from data or props) ─────────────────────────
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

	// ── Build rows ─────────────────────────────────────────────────
	const rows: TimelineRowData[] = useMemo(
		() =>
			employeeList.map((emp) => ({
				id: emp.pin,
				name: emp.name,
				subLabel: emp.pin,
				blocks: buildBlocks(punchesByEmployee.get(emp.pin) ?? [], translate),
			})),
		[employeeList, punchesByEmployee, translate],
	);

	// ── Legend ─────────────────────────────────────────────────────
	const legendItems = useMemo(() => buildLegendItems(translate), [translate]);

	return { rows, legendItems, isLoading, punchesByEmployee, employeeList };
}

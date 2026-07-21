import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";

import { fetchTimelineDay, type TimelineBlock as ApiTimelineBlock, type TimelineEmployeeBlocks } from "@/lib/api/attendance";
import { QueryKeys } from "@/lib/query-keys";
import type { TimelineEmployee } from "../types";

// ── Types ──────────────────────────────────────────────────────────────────────

/** Mirrors the shared Timeline's TimelineBlockData type. */
type TimelineBlockData = {
	left: number;
	width: number;
	color: "present" | "warning" | "overtime" | "default";
	title?: string;
};

/** Mirrors the shared Timeline's TimelineRowData type. */
export type TimelineRowData = {
	id: string;
	name: string;
	subLabel?: string;
	blocks: TimelineBlockData[];
	onClick?: () => void;
};

export type UsePunchBlocksOptions = {
	/** The selected day (YYYY-MM-DD string for the backend). */
	date: Date;
	/** Device serial filter from page context. */
	deviceSns?: string;
	/** Punch status filter from page context. */
	status?: string;
	/** Optional pre-provided employee list (e.g., from parent page). */
	employees?: TimelineEmployee[];
	/** Translation function for legend labels. */
	translate: (key: string) => string;
};

export type UsePunchBlocksResult = {
	/** Timeline rows ready for the Timeline component. */
	rows: TimelineRowData[];
	/** Legend items (color + translated label). */
	legendItems: Array<{ color: "present" | "warning" | "overtime"; label: string }>;
	/** Loading state. */
	isLoading: boolean;
	/** Raw employee data (for side panel click handlers). */
	employeeData: TimelineEmployeeBlocks[];
	/** Derived employee list (from data if not provided). */
	employeeList: TimelineEmployee[];
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function toISODate(date: Date): string {
	return date.toISOString().split("T")[0]!;
}

function mapToTimelineRowData(emp: TimelineEmployeeBlocks): TimelineRowData {
	return {
		id: emp.pin,
		name: emp.name || emp.pin,
		subLabel: emp.pin,
		blocks: emp.blocks.map(
			(b: ApiTimelineBlock): TimelineBlockData => ({
				left: b.left,
				width: b.width,
				color: b.color as TimelineBlockData["color"],
				title: b.title,
			}),
		),
	};
}

// ── Hook ────────────────────────────────────────────────────────────────────

/**
 * Fetches timeline data from the backend `/api/attendance/timeline` endpoint
 * and maps it to rows + legend for the shared Timeline component.
 *
 * No raw punches are fetched — the backend pre-computes blocks and summaries.
 */
export function usePunchBlocks({
	date,
	deviceSns,
	status,
	employees,
	translate,
}: UsePunchBlocksOptions): UsePunchBlocksResult {
	const dateStr = useMemo(() => toISODate(date), [date]);

	const queryParams = useMemo(
		() => ({
			date: dateStr,
			...(deviceSns ? { device_sns: deviceSns } : {}),
			...(status ? { status } : {}),
		}),
		[dateStr, deviceSns, status],
	);

	const { data, isLoading } = useQuery({
		queryKey: QueryKeys.attendance.timeline(queryParams),
		queryFn: () => fetchTimelineDay(queryParams),
	});

	// ── Employee list (from data or props) ─────────────────────────────
	const employeeList: TimelineEmployee[] = useMemo(() => {
		if (employees && employees.length > 0) return employees;
		if (!data?.employees) return [];
		const seen = new Set<string>();
		const list: TimelineEmployee[] = [];
		for (const emp of data.employees) {
			if (!seen.has(emp.pin)) {
				seen.add(emp.pin);
				list.push({ pin: emp.pin, name: emp.name || emp.pin });
			}
		}
		return list;
	}, [data, employees]);

	// ── Build rows ──────────────────────────────────────────────────────
	const rows: TimelineRowData[] = useMemo(
		() => (data?.employees ?? []).map(mapToTimelineRowData),
		[data],
	);

	// ── Legend ──────────────────────────────────────────────────────────
	const legendItems = useMemo(
		() => [
			{ color: "present" as const, label: translate("Present") },
			{ color: "warning" as const, label: translate("Break") },
			{ color: "overtime" as const, label: translate("Overtime") },
		],
		[translate],
	);

	return {
		rows,
		legendItems,
		isLoading,
		employeeData: data?.employees ?? [],
		employeeList,
	};
}

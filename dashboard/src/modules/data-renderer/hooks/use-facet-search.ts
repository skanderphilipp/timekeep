/**
 * useFacetSearch — debounced search-as-you-type for reference facets.
 *
 * Calls the entity's facet endpoint with `?dimension=X&search=Y` and
 * respects active filter context for contextual counts.
 *
 * Used by ReferenceFacetSelector to replace static <Select> for
 * high-cardinality reference dimensions (devices, employees, actors).
 */

import { useQuery } from "@tanstack/react-query";
import { useMemo, useState, useCallback } from "react";
import { useDebouncedCallback } from "use-debounce";

import {
	fetchPunchFilters,
	fetchDeviceFilters,
	fetchEmployeeFilters,
	fetchAuditFilters,
} from "@/lib/api";
import type { FacetGroup, FacetOption, FacetFilterParams } from "@/lib/api";

// ── Constants ───────────────────────────────────────────────────────────

const DEBOUNCE_MS = 250;
const MIN_SEARCH_LENGTH = 2;
const DEFAULT_LIMIT = 20;

// ── Entity → Facet Fetcher Registry ─────────────────────────────────────

type FacetFetcher = (params: Record<string, unknown>) => Promise<FacetGroup[]>;

const FACET_FETCHERS: Record<string, FacetFetcher> = {
	punch: (p) => fetchPunchFilters(p as FacetFilterParams),
	device: (p) => fetchDeviceFilters(p as any),
	employee: (p) => fetchEmployeeFilters(p as any),
	audit: (p) => fetchAuditFilters(p as any),
};

function getFacetFetcher(entity: string): FacetFetcher | undefined {
	return FACET_FETCHERS[entity];
}

// ── Types ───────────────────────────────────────────────────────────────

export type FacetOptionItem = {
	value: string;
	label: string;
	count?: number | null;
};

export type UseFacetSearchOptions = {
	/** Entity name matching a backend schema. */
	entity: string;
	/** Facet dimension key (e.g. "device_sn", "actor"). */
	dimension: string;
	/** Active filter context for contextual counts. */
	context?: Record<string, unknown>;
	/** Custom limit (default: 20). */
	limit?: number;
};

export type UseFacetSearchResult = {
	/** Current search query. */
	search: string;
	/** Update search (debounced). */
	setSearch: (q: string) => void;
	/** Facet options for current search. */
	options: FacetOptionItem[];
	/** Whether results are loading. */
	isLoading: boolean;
	/** Whether a search is in progress. */
	isSearching: boolean;
	/** Reset search to show top results. */
	reset: () => void;
};

// ── Hook ────────────────────────────────────────────────────────────────

/**
 * Debounced search-as-you-type for reference facet dimensions.
 *
 * Calls the entity's facet endpoint with `?dimension=X&search=Y`.
 * Respects active filter context (since, until, status, etc.) for
 * contextual punch/record counts.
 *
 * @example
 * ```tsx
 * const { search, setSearch, options, isLoading } = useFacetSearch({
 *   entity: "punch",
 *   dimension: "device_sn",
 *   context: { since: "2026-07-01", until: "2026-07-31" },
 * });
 * ```
 */
export function useFacetSearch({
	entity,
	dimension,
	context = {},
	limit = DEFAULT_LIMIT,
}: UseFacetSearchOptions): UseFacetSearchResult {
	const fetcher = getFacetFetcher(entity);

	// Debounced search query
	const [search, setSearchRaw] = useState("");
	const debouncedSetSearch = useDebouncedCallback(
		(q: string) => setSearchRaw(q),
		DEBOUNCE_MS,
	);

	const setSearch = useCallback(
		(q: string) => debouncedSetSearch(q),
		[debouncedSetSearch],
	);

	const reset = useCallback(() => {
		setSearchRaw("");
	}, []);

	// Fetch with search + context
	const { data: groups, isFetching } = useQuery({
		queryKey: ["facet-search", entity, dimension, search, context] as const,
		queryFn: () => {
			if (!fetcher) return Promise.resolve([]);
			return fetcher({
				dimension,
				search: search.length >= MIN_SEARCH_LENGTH ? search : undefined,
				limit,
				...context,
			});
		},
		enabled: !!fetcher,
		staleTime: 30_000,
	});

	const options = useMemo<FacetOptionItem[]>(() => {
		const raw = groups?.[0]?.options ?? [];
		return raw.map((o: FacetOption) => ({
			value: o.value,
			label: o.label || o.value,
			count: o.count,
		}));
	}, [groups]);

	return {
		search,
		setSearch,
		options,
		isLoading: isFetching,
		isSearching: isFetching && search.length >= MIN_SEARCH_LENGTH,
		reset,
	};
}

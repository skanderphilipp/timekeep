import { useCallback } from "react";
import { useQuery } from "@tanstack/react-query";

import { useListState } from "@/infrastructure/query-params";
import { fetchAuditLogs } from "@/lib/api";
import { QueryKeys } from "@/lib/query-keys";
import { DEFAULT_PAGE_SIZE } from "@/lib/constants";
import { useSchemaColumns } from "@/modules/data-renderer/hooks/use-schema-columns";
import type { AuditEvent, AuditFilter } from "@/lib/api";

type AuditFilterValues = Omit<AuditFilter, "sort_by" | "sort_order" | "limit" | "cursor">;

const auditFilterDefaults: AuditFilterValues = {
	search: "",
	since: "",
	until: "",
	actor: "",
	action: "",
	resource: "",
};

export function useAuditLog() {
	const { columns: schemaColumns } = useSchemaColumns("audit");
	const columns = schemaColumns.length > 0 ? schemaColumns : [];

	const {
		filters,
		setFilter,
		resetFilters,
		hasActiveFilters,
		sort,
		toggleSort,
	} = useListState<AuditFilterValues>({
		namespace: "audit",
		filterDefaults: auditFilterDefaults,
		sortDefaults: { column: "timestamp", direction: "desc" },
	});

	const query = useQuery({
		queryKey: QueryKeys.audit.list({
			...filters,
			limit: DEFAULT_PAGE_SIZE,
			sort_by: sort?.column,
			sort_order: sort?.direction,
		}),
		queryFn: () =>
			fetchAuditLogs({
				...filters,
				limit: DEFAULT_PAGE_SIZE,
				sort_by: sort?.column,
				sort_order: sort?.direction,
			}),
	});

	const handleSearchChange = useCallback(
		(value: string) => setFilter({ search: value }),
		[setFilter],
	);

	return {
		columns,
		data: query.data ?? [],
		isLoading: query.isLoading,
		error: query.error?.message ?? null,
		onRetry: () => query.refetch(),
		getRowKey: (e: AuditEvent) => e.id,
		sortState: sort
			? ({ column: sort.column, direction: sort.direction } as const)
			: null,
		onSortChange: toggleSort,
		searchValue: (filters.search as string) ?? "",
		onSearchChange: handleSearchChange,
		hasActiveFilters,
		onClearFilters: () => resetFilters(),
		resultCount: query.data?.length,
	};
}

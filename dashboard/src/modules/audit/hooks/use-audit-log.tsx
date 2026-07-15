import { useMemo, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLingui } from "@lingui/react";

import { useListState } from "@/infrastructure/query-params";
import { fetchAuditLogs } from "@/lib/api";
import { QueryKeys } from "@/lib/query-keys";
import { DEFAULT_PAGE_SIZE } from "@/lib/constants";
import { createAuditColumns } from "@/modules/data-renderer/column-definitions/audit-columns";
import type { AuditEvent, AuditFilter } from "@/lib/api";

// ── Filter defaults ────────────────────────────────────────────────────

type AuditFilterValues = Omit<AuditFilter, "sort_by" | "sort_order" | "limit" | "cursor">;

const auditFilterDefaults: AuditFilterValues = {
  search: "",
  since: "",
  until: "",
  actor: "",
  action: "",
  resource: "",
};

// ── Hook ────────────────────────────────────────────────────────────────

/**
 * Audit log list — returns data and state for `DataTableContainer`.
 *
 * Uses `createAuditColumns` (data-renderer) for type-safe, auto-dispatched
 * column rendering via `FieldDisplay`. Sort, search, and filter state are
 * managed through URL query params via `useListState`.
 */
export function useAuditLog() {
  const { _ } = useLingui();
  const columns = useMemo(() => createAuditColumns(_), [_]);

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
    searchValue: filters.search ?? "",
    onSearchChange: handleSearchChange,
    hasActiveFilters,
    onClearFilters: () => resetFilters(),
    resultCount: query.data?.length,
  };
}

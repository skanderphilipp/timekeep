import { useState, useMemo, useCallback } from "react";

import { useOpenDetailPanel } from "@/infrastructure/side-panel/hooks/use-side-panel-navigation";
import { useWorkPolicyTemplates } from "./use-work-policies";
import { useSchemaColumns } from "@/modules/data-renderer/hooks/use-schema-columns";
import {
  useFilterFields,
  renderFilterDimensions,
} from "@/modules/data-renderer";
import type { FilterRenderContext } from "@/modules/data-renderer";
import type { WorkPolicyTemplate } from "@/lib/api";
import { useRecordInlineEdit } from "@/modules/record-detail";

/**
 * Fields that support inline editing in the work policy list table.
 */
const EDITABLE_WORK_POLICY_FIELDS = new Set(["title"]);

/**
 * Work policy list page orchestration hook.
 *
 * Follows the same pattern as {@link useDepartmentsPage}:
 * all state, filtering, inline editing, and handler logic lives here.
 * The view component gets a flat object with everything it needs.
 */
export function useWorkPoliciesPage() {
  const openDetailPanel = useOpenDetailPanel();
  const query = useWorkPolicyTemplates();

  // ── Schema-driven columns ───────────────────────────────────────────

  const { columns: schemaColumns, isLoading: schemaLoading } = useSchemaColumns("work_policy");

  // ── Inline editing mutation ────────────────────────────────────────

  const editWorkPolicy = useRecordInlineEdit("work_policy");

  // Mark editable columns
  const columns = useMemo(
    () =>
      schemaColumns.map((col) => ({
        ...col,
        editable: EDITABLE_WORK_POLICY_FIELDS.has(col.fieldId),
      })),
    [schemaColumns],
  );

  const editingConfig = useMemo(
    () => ({
      onPersist: (rowId: string, field: string, value: unknown) => {
        editWorkPolicy.mutate({ rowId, field, value });
      },
      editableColumns: Array.from(EDITABLE_WORK_POLICY_FIELDS),
    }),
    [editWorkPolicy.mutate],
  );

  // ── Filter state ────────────────────────────────────────────────────

  const [search, setSearch] = useState("");

  // ── Filter dimensions from schema ───────────────────────────────────

  const { dimensions: filterDimensions } = useFilterFields("work_policy");

  // ── Client-side filtering ───────────────────────────────────────────

  const filtered = useMemo(() => {
    let list = query.data ?? [];
    const q = search.toLowerCase().trim();

    if (q) {
      list = list.filter((d) => d.title.toLowerCase().includes(q));
    }

    return list;
  }, [query.data, search]);

  // ── Derived state ────────────────────────────────────────────────────

  const hasActiveFilters = search.length > 0;

  // ── Handlers ─────────────────────────────────────────────────────────

  const handleClearFilters = useCallback(() => {
    setSearch("");
  }, []);

  const handleRowClick = useCallback(
    (d: WorkPolicyTemplate) => openDetailPanel("work_policy", d.id, d.title),
    [openDetailPanel],
  );

  // ── Filter bar context ──────────────────────────────────────────────

  const filterContext = useMemo<FilterRenderContext>(
    () => ({
      values: {} as Record<string, string | undefined>,
      handlers: {} as Record<string, (value: string) => void>,
      enumOptions: {},
    }),
    [],
  );

  const filterFields = useMemo(
    () => renderFilterDimensions(filterDimensions, filterContext),
    [filterDimensions, filterContext],
  );

  return {
    columns,
    data: filtered,
    isLoading: query.isLoading || schemaLoading,
    error: query.error?.message ?? null,
    refetch: () => query.refetch(),
    resultCount: filtered.length,

    searchValue: search,
    onSearchChange: setSearch,
    filterFields,
    hasActiveFilters,
    onClearFilters: handleClearFilters,

    onRowClick: handleRowClick,
    editingConfig,

    hasPolicies: (query.data?.length ?? 0) > 0,
  } as const;
}

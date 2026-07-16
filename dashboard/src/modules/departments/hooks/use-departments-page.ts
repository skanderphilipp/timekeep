import { useState, useMemo, useCallback } from "react";
import { useLingui } from "@lingui/react";
import { msg } from "@lingui/core/macro";

import { useOpenDetailPanel } from "@/infrastructure/side-panel/hooks/use-side-panel-navigation";
import { useDepartments } from "./use-departments";
import { useSchemaColumns } from "@/modules/data-renderer/hooks/use-schema-columns";
import {
  useFilterFields,
  renderFilterDimensions,
} from "@/modules/data-renderer";
import type { FilterRenderContext } from "@/modules/data-renderer";
import type { Department } from "@/lib/api";
import { useRecordInlineEdit } from "@/modules/record-detail";

/**
 * Fields that support inline editing in the department list table.
 */
const EDITABLE_DEPARTMENT_FIELDS = new Set(["name"]);

/**
 * Department list page orchestration hook.
 *
 * Follows the same pattern as {@link useEmployeeListPage}:
 * all state, filtering, inline editing, and handler logic lives here.
 * The view component gets a flat object with everything it needs.
 */
export function useDepartmentsPage() {
  const { _ } = useLingui();
  const openDetailPanel = useOpenDetailPanel();
  const query = useDepartments();

  // ── Schema-driven columns ───────────────────────────────────────────

  const { columns: schemaColumns, isLoading: schemaLoading } = useSchemaColumns("department");

  // ── Inline editing mutation ────────────────────────────────────────

  const editDepartment = useRecordInlineEdit("department");

  // Mark editable columns
  const columns = useMemo(
    () =>
      schemaColumns.map((col) => ({
        ...col,
        editable: EDITABLE_DEPARTMENT_FIELDS.has(col.fieldId),
      })),
    [schemaColumns],
  );

  const editingConfig = useMemo(
    () => ({
      onPersist: (rowId: string, field: string, value: unknown) => {
        editDepartment.mutate({ rowId, field, value });
      },
      editableColumns: Array.from(EDITABLE_DEPARTMENT_FIELDS),
    }),
    [editDepartment.mutate],
  );

  // ── Filter state ────────────────────────────────────────────────────

  const [search, setSearch] = useState("");
  const [hasCustomPolicyFilter, setHasCustomPolicyFilter] = useState("");

  // ── Filter dimensions from schema ───────────────────────────────────

  const { dimensions: filterDimensions } = useFilterFields("department");

  // ── Client-side filtering ───────────────────────────────────────────

  const filtered = useMemo(() => {
    let list = query.data ?? [];
    const q = search.toLowerCase().trim();

    if (q) {
      list = list.filter((d) => d.name.toLowerCase().includes(q));
    }

    if (hasCustomPolicyFilter) {
      const hasCustom = hasCustomPolicyFilter === "custom";
      list = list.filter((d) => {
        const policyExists = !!(d.work_policy_id || d.work_policy);
        return hasCustom ? policyExists : !policyExists;
      });
    }

    return list;
  }, [query.data, search, hasCustomPolicyFilter]);

  // ── Derived state ────────────────────────────────────────────────────

  const hasActiveFilters = search.length > 0 || hasCustomPolicyFilter.length > 0;

  // ── Handlers ─────────────────────────────────────────────────────────

  const handleClearFilters = useCallback(() => {
    setSearch("");
    setHasCustomPolicyFilter("");
  }, []);

  const handleRowClick = useCallback(
    (d: Department) => openDetailPanel("department", d.id, d.name),
    [openDetailPanel],
  );

  // ── Filter bar context ──────────────────────────────────────────────

  const filterContext = useMemo<FilterRenderContext>(
    () => ({
      values: {
        has_custom_policy: hasCustomPolicyFilter,
      } as Record<string, string | undefined>,
      handlers: {
        has_custom_policy: (value: string) => setHasCustomPolicyFilter(value),
      },
      enumOptions: {
        has_custom_policy: [
          { value: "", label: _(msg`All`) },
          { value: "custom", label: _(msg`Custom`) },
          { value: "default", label: _(msg`Default`) },
        ],
      },
    }),
    [hasCustomPolicyFilter, _],
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

    hasDepartments: (query.data?.length ?? 0) > 0,
  } as const;
}

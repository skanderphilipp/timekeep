import { useState, useMemo, useCallback } from "react";
import { useLingui } from "@lingui/react";
import { msg } from "@lingui/core/macro";
import { IconTable, IconCalendar } from "@tabler/icons-react";
import { useNavigate } from "react-router-dom";

import { AppRoute } from "@/lib/navigation";
import { QueryKeys } from "@/lib/query-keys";
import { useEmployeeList } from "./use-employee-list";
import { useEmployeeFacetOptions } from "./use-employee-facet-options";
import { useSchemaColumns } from "@/modules/data-renderer/hooks/use-schema-columns";
import {
  useFilterFields,
  renderFilterDimensions,
} from "@/modules/data-renderer";
import type { FilterRenderContext } from "@/modules/data-renderer";
import type { ViewType } from "@/modules/shared/components";
import type { Employee } from "@/lib/api/employees";
import { updateEmployee } from "@/lib/api/employees";
import { useInlineEditMutation } from "@/hooks";

/**
 * Fields that support inline editing in the employee list table.
 * Each value is the `ColumnDefinition.id` (maps to the schema field name).
 */
const EDITABLE_EMPLOYEE_FIELDS = new Set(["name", "department"]);

/**
 * Employee list page orchestration hook.
 *
 * Extracts ALL state, filtering, and callbacks from {@link EmployeeListView}
 * so the view component can be a pure JSX composition.
 *
 * Pattern: mirrors {@link usePunchQueryPage} from the punches module.
 */
export function useEmployeeListPage() {
  const { _ } = useLingui();
  const navigate = useNavigate();
  const query = useEmployeeList();

  // ── View state ─────────────────────────────────────────────────────

  const [currentView, setCurrentView] = useState<ViewType>("table");

  // ── Inline editing mutation (Phase 4) ──────────────────────────────

  const editEmployee = useInlineEditMutation<Employee>({
    queryKey: QueryKeys.employees.list(),
    getRowKey: (e) => e.id,
    mutationFn: ({ rowId, field, value }) =>
      updateEmployee(rowId, { [field]: value as string }),
  });

  // ── Schema-driven columns ───────────────────────────────────────────

  const { columns: schemaColumns, isLoading: schemaLoading } = useSchemaColumns("employee");

  // Mark editable fields on columns
  const columns = useMemo(
    () =>
      schemaColumns.map((col) => ({
        ...col,
        editable: EDITABLE_EMPLOYEE_FIELDS.has(col.fieldId),
      })),
    [schemaColumns],
  );

  // ── Editing config passed to DataTableContainer ─────────────────────

  const editingConfig = useMemo(
    () => ({
      onPersist: (rowId: string, field: string, value: unknown) => {
        editEmployee.mutate({ rowId, field, value });
      },
      editableColumns: Array.from(EDITABLE_EMPLOYEE_FIELDS),
    }),
    [editEmployee.mutate],
  );

  // ── Filter state ────────────────────────────────────────────────────

  const [search, setSearch] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("");
  const [activeFilter, setActiveFilter] = useState("");

  // ── Facet-powered filter options ────────────────────────────────────

  const facetOptions = useEmployeeFacetOptions();

  // ── Filter dimensions from schema ───────────────────────────────────

  const { dimensions: filterDimensions } = useFilterFields("employee");

  // ── Client-side filtering ───────────────────────────────────────────

  const filtered = useMemo(() => {
    let list = query.data ?? [];
    const q = search.toLowerCase().trim();

    if (q) {
      list = list.filter(
        (e) =>
          e.pin.includes(q) ||
          e.name.toLowerCase().includes(q) ||
          e.department?.toLowerCase().includes(q),
      );
    }

    if (departmentFilter) {
      list = list.filter((e) => e.department === departmentFilter);
    }

    if (activeFilter) {
      const isActive = activeFilter === "true";
      list = list.filter((e) => e.active === isActive);
    }

    return list;
  }, [query.data, search, departmentFilter, activeFilter]);

  // ── Derived state ───────────────────────────────────────────────────

  const hasActiveFilters = search.length > 0 || departmentFilter.length > 0 || activeFilter.length > 0;
  const hasEmployees = (query.data?.length ?? 0) > 0;

  // ── Handlers ────────────────────────────────────────────────────────

  const handleClearFilters = useCallback(() => {
    setSearch("");
    setDepartmentFilter("");
    setActiveFilter("");
  }, []);

  const handleRowClick = useCallback(
    (e: Employee) => navigate(AppRoute.employees.detail(e.id)),
    [navigate],
  );

  const handleViewChange = useCallback((view: ViewType) => setCurrentView(view), []);

  const today = useMemo(() => new Date(), []);
  const calendarYear = today.getFullYear();
  const calendarMonth = today.getMonth() + 1;

  /**
   * TODO(ENTERPRISE): Navigate to daily attendance detail for the selected date.
   *
   * Phase: Employee detail / attendance drill-down (Phase G)
   * Impact: Calendar day click has no effect — user can't drill into daily attendance.
   * Fix: Build a daily attendance overlay or navigate to a date-filtered punch view.
   */
  const handleCalendarDayClick = useCallback((_date: string) => {}, []);

  // ── View options ────────────────────────────────────────────────────

  const viewOptions = useMemo(
    () => [
      { value: "table" as const, label: _(msg`Table`), icon: <IconTable size={14} /> },
      { value: "calendar" as const, label: _(msg`Calendar`), icon: <IconCalendar size={14} /> },
    ],
    [_],
  );

  // ── Filter bar context ─────────────────────────────────────────────

  const filterContext = useMemo<FilterRenderContext>(
    () => ({
      values: {
        department: departmentFilter,
        active: activeFilter,
      } as Record<string, string | undefined>,
      handlers: {
        department: (value: string) => setDepartmentFilter(value),
        active: (value: string) => setActiveFilter(value),
      },
      enumOptions: {
        department: facetOptions.departmentOptions,
        active: facetOptions.activeOptions,
      },
    }),
    [departmentFilter, activeFilter, facetOptions],
  );

  const filterFields = useMemo(
    () => renderFilterDimensions(filterDimensions, filterContext),
    [filterDimensions, filterContext],
  );

  return {
    // Data
    columns,
    data: filtered,
    isLoading: query.isLoading || schemaLoading,
    error: query.error?.message ?? null,
    refetch: () => query.refetch(),
    resultCount: filtered.length,

    // Search & filters
    searchValue: search,
    onSearchChange: setSearch,
    filterFields,
    hasActiveFilters,
    onClearFilters: handleClearFilters,

    // Views
    viewOptions,
    currentView,
    onViewChange: handleViewChange,
    calendarYear,
    calendarMonth,
    onCalendarDayClick: handleCalendarDayClick,

    // Row interaction
    onRowClick: handleRowClick,

    // Inline editing (Phase 4)
    editingConfig,

    // Derived
    hasEmployees,
  } as const;
}

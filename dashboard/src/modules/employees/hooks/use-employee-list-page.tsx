import { useState, useMemo, useCallback } from "react";
import { useLingui } from "@lingui/react";
import { msg } from "@lingui/core/macro";
import { IconTable, IconCalendar } from "@tabler/icons-react";

import { useOpenDetailPanel } from "@/infrastructure/side-panel/hooks/use-side-panel-navigation";
import { useEmployeeList } from "./use-employee-list";
import { useEmployeeFacetOptions } from "./use-employee-facet-options";
import { useSchemaColumns } from "@/modules/data-renderer/hooks/use-schema-columns";
import {
  useFilterFields,
  renderFilterDimensions,
} from "@/modules/data-renderer";
import type { FilterRenderContext, ColumnDefinition, FieldMetadata } from "@/modules/data-renderer";
import type { ViewType } from "@/modules/shared/components";
import type { Employee } from "@/lib/api/employees";
import { fetchEnrollmentSummary } from "@/lib/api/employees";
import type { EnrollmentSummaryEntry } from "@/lib/api/employees";
import { useRecordInlineEdit } from "@/modules/record-detail";
import { fetchDepartments } from "@/lib/api/departments";
import { useQuery } from "@tanstack/react-query";
import { QueryKeys } from "@/lib/query-keys";
import { Badge } from "@/components/ui";

/**
 * Fields that support inline editing in the employee list table.
 *
 * Department is now editable — the `FieldEdit` dispatcher renders a
 * `FieldSelectInput` with department options loaded via `useQuery`.
 * Options are injected into the column metadata in the `columns` useMemo.
 *
 * TODO(ENTERPRISE): Make this schema-driven from the backend.
 * The backend `ColumnMeta` should eventually carry an `editable: boolean` field.
 */
const EDITABLE_EMPLOYEE_FIELDS = new Set(["name", "department"]);

/**
 * Employee list page orchestration hook.
 */
export function useEmployeeListPage() {
  const { _ } = useLingui();
  const openDetailPanel = useOpenDetailPanel();
  const query = useEmployeeList();

  // ── View state ─────────────────────────────────────────────────────

  const [currentView, setCurrentView] = useState<ViewType>("table");

  // ── Inline editing mutation ────────────────────────────────────────

  const editEmployee = useRecordInlineEdit("employee");

  // ── Facet options (needed for filter dropdowns) ────────────────────

  const facetOptions = useEmployeeFacetOptions();

  // ── Schema-driven columns ───────────────────────────────────────────

  const { columns: schemaColumns, isLoading: schemaLoading } = useSchemaColumns("employee");

  // ── Department options for FK reference editing ────────────────────

  const { data: departments } = useQuery({
    queryKey: QueryKeys.departments.list(),
    queryFn: fetchDepartments,
    staleTime: 5 * 60 * 1000,
  });

  // ── Enrollment summary (for list view badges) ──────────────────────

  const { data: enrollmentSummary } = useQuery({
    queryKey: QueryKeys.employees.enrollmentSummary(),
    queryFn: fetchEnrollmentSummary,
    staleTime: 30_000,
  });

  const enrollmentByPin = useMemo(() => {
    const map = new Map<string, EnrollmentSummaryEntry>();
    if (enrollmentSummary) {
      for (const entry of enrollmentSummary) {
        map.set(entry.pin, entry);
      }
    }
    return map;
  }, [enrollmentSummary]);

  // Mark editable fields and inject reference options
  const columns = useMemo(
    () => {
      const base = schemaColumns.map((col) => {
        const editable = EDITABLE_EMPLOYEE_FIELDS.has(col.fieldId);

        // Inject department options into the reference column metadata
        if (col.fieldId === "department" && col.type === "reference" && departments) {
          const deptOptions = departments.map((d) => ({
            value: d.id,
            label: d.name,
          }));
          return {
            ...col,
            editable,
            metadata: { ...col.metadata, options: deptOptions },
          };
        }

        return { ...col, editable };
      });

      // Append enrollment status column
      const enrollmentCol: ColumnDefinition<FieldMetadata> = {
        id: "enrollment",
        header: _(msg`Enrollment`),
        fieldId: "enrollment",
        label: _(msg`Enrollment`),
        type: "text" as const,
        metadata: {
          fieldName: "enrollment",
          isSortable: false,
        },
        align: "center",
        editable: false,
        render: (row: unknown) => {
          const emp = row as Employee;
          const info = enrollmentByPin.get(emp.pin);
          if (!info || info.device_count === 0) {
            return (
              <Badge
                variant="warning"
                size="sm"
              >
                {_(msg`Not enrolled`)}
              </Badge>
            );
          }
          const fpLabel = info.has_fingerprint
            ? ` • ${_(msg`FP`)}`
            : "";
          return (
            <Badge
              variant="success"
              size="sm"
            >
              {info.device_count} {_(msg`devices`)}{fpLabel}
            </Badge>
          );
        },
      };
      base.push(enrollmentCol as typeof base[number]);

      return base;
    },
    [schemaColumns, departments, enrollmentByPin, _],
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
    (e: Employee) => openDetailPanel("employee", e.id, e.name),
    [openDetailPanel],
  );

  const handleViewChange = useCallback((view: ViewType) => setCurrentView(view), []);

  const today = useMemo(() => new Date(), []);
  const calendarYear = today.getFullYear();
  const calendarMonth = today.getMonth() + 1;

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

    viewOptions,
    currentView,
    onViewChange: handleViewChange,
    calendarYear,
    calendarMonth,
    onCalendarDayClick: handleCalendarDayClick,

    onRowClick: handleRowClick,
    editingConfig,

    hasEmployees,
  } as const;
}

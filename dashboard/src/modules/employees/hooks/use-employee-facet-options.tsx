/**
 * Facet-powered filter options for the employee list page.
 *
 * Uses `GET /api/employees/filters` for data-driven dropdowns with
 * contextual counts and search-as-you-type for department names.
 *
 * Pattern: mirrors `usePunchFacetOptions` from the punches module.
 */
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState, useCallback } from "react";
import { useLingui } from "@lingui/react";
import { msg } from "@lingui/core/macro";
import { useDebouncedCallback } from "use-debounce";

import { fetchEmployeeFilters, type EmployeeFacetParams, type FacetOption } from "@/lib/api";
import { QueryKeys } from "@/lib/query-keys";
import { Text, type ComboboxOption } from "@/components/ui";

// ── Helpers ───────────────────────────────────────────────────────────────────

const DEBOUNCE_MS = 200;
const MIN_SEARCH_LENGTH = 2;

function facetToOption(opt: FacetOption): ComboboxOption {
  return {
    value: opt.value,
    label: opt.label || opt.value,
    suffix:
      opt.count !== undefined && opt.count !== null ? (
        <Text as="span" variant="caption" color="tertiary">
          {opt.count}
        </Text>
      ) : undefined,
  };
}

// ── Hook ──────────────────────────────────────────────────────────────────────

type UseEmployeeFacetOptionsReturn = {
  departmentOptions: ComboboxOption[];
  departmentsLoading: boolean;
  searchDepartments: (q: string) => void;
  resetDepartmentSearch: () => void;
  activeOptions: ComboboxOption[];
  activeLoading: boolean;
};

export function useEmployeeFacetOptions(
  context: EmployeeFacetParams = {},
): UseEmployeeFacetOptionsReturn {
  const { _ } = useLingui();

  // ── Department options (load once, contextual counts per active filters) ─

  const { data: departmentGroup, isLoading: departmentsLoading } = useQuery({
    queryKey: QueryKeys.employees.filters({ dimension: "department", ...context }),
    queryFn: () => fetchEmployeeFilters({ dimension: "department", ...context }),
    staleTime: 60_000,
  });

  const departmentOptions = useMemo(() => {
    const opts: ComboboxOption[] = [{ value: "", label: _(msg`All Departments`) }];
    for (const opt of departmentGroup?.[0]?.options ?? []) {
      opts.push(facetToOption(opt));
    }
    return opts;
  }, [departmentGroup, _]);

  // ── Department search (debounced) ───────────────────────────────────────────

  const [deptQuery, setDeptQuery] = useState("");

  const debouncedSetDeptQuery = useDebouncedCallback(
    (q: string) => setDeptQuery(q),
    DEBOUNCE_MS,
  );

  const { data: searchGroup, isFetching: departmentsSearching } = useQuery({
    queryKey: QueryKeys.employees.filters({
      dimension: "department",
      search: deptQuery,
      ...context,
    }),
    queryFn: () =>
      fetchEmployeeFilters({
        dimension: "department",
        search: deptQuery,
        ...context,
      }),
    enabled: deptQuery.length >= MIN_SEARCH_LENGTH,
    staleTime: 30_000,
  });

  const resetDepartmentSearch = useCallback(() => {
    setDeptQuery("");
  }, []);

  // Merge search results into department options when searching
  const mergedDepartmentOptions = useMemo(() => {
    if (deptQuery.length >= MIN_SEARCH_LENGTH) {
      return (searchGroup?.[0]?.options ?? []).map(facetToOption);
    }
    return departmentOptions;
  }, [deptQuery, searchGroup, departmentOptions]);

  // ── Active status options (static enum, no fetching needed) ─────────────────

  const { data: activeGroup, isLoading: activeLoading } = useQuery({
    queryKey: QueryKeys.employees.filters({ dimension: "active" }),
    queryFn: () => fetchEmployeeFilters({ dimension: "active" }),
    staleTime: 5 * 60_000,
  });

  const activeOptions = useMemo(() => {
    const opts: ComboboxOption[] = [{ value: "", label: _(msg`All`) }];
    for (const opt of activeGroup?.[0]?.options ?? []) {
      opts.push(facetToOption(opt));
    }
    return opts;
  }, [activeGroup, _]);

  return {
    departmentOptions: mergedDepartmentOptions,
    departmentsLoading: departmentsLoading || departmentsSearching,
    searchDepartments: debouncedSetDeptQuery,
    resetDepartmentSearch,
    activeOptions,
    activeLoading,
  };
}

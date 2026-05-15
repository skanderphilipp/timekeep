/**
 * Facet-powered filter options for the punch query page.
 *
 * Uses `GET /api/punches/filters` for data-driven dropdowns with
 * contextual punch counts and search-as-you-type for employees.
 */
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState, useCallback } from "react";
import { useLingui } from "@lingui/react";
import { msg } from "@lingui/core/macro";
import { useDebouncedCallback } from "use-debounce";

import { fetchPunchFilters, type FacetFilterParams, type FacetOption } from "@/lib/api";
import { QueryKeys } from "@/lib/query-keys";
import type { ComboboxOption } from "@/components/ui/combobox";

// ── Helpers ───────────────────────────────────────────────────────────────────

const DEBOUNCE_MS = 200;
const MIN_SEARCH_LENGTH = 2;

function facetToOption(opt: FacetOption): ComboboxOption {
  return {
    value: opt.value,
    label: opt.label || opt.value,
    suffix:
      opt.count !== undefined && opt.count !== null ? (
        <span className="facetCount">{opt.count}</span>
      ) : undefined,
  };
}

// ── Hook ──────────────────────────────────────────────────────────────────────

type UsePunchFacetOptionsReturn = {
  deviceOptions: ComboboxOption[];
  devicesLoading: boolean;
  labelBySn: Map<string, string>;
  searchEmployees: (q: string) => void;
  employeeOptions: ComboboxOption[];
  employeesLoading: boolean;
  resetEmployeeSearch: () => void;
};

export function usePunchFacetOptions(
  context: FacetFilterParams = {},
): UsePunchFacetOptionsReturn {
  const { _ } = useLingui();

  // ── Device options (load once, contextual counts per active filters) ─────

  const { data: deviceGroup, isLoading: devicesLoading } = useQuery({
    queryKey: QueryKeys.punches.filters({ dimension: "device_sn", ...context }),
    queryFn: () => fetchPunchFilters({ dimension: "device_sn", ...context }),
    staleTime: 60_000,
  });

  const { deviceOptions, labelBySn } = useMemo(() => {
    const map = new Map<string, string>();
    const opts: ComboboxOption[] = [{ value: "", label: _(msg`All Devices`) }];

    for (const opt of deviceGroup?.[0]?.options ?? []) {
      const label = opt.label || opt.value;
      map.set(opt.value, label);
      opts.push(facetToOption(opt));
    }

    return { deviceOptions: opts, labelBySn: map };
  }, [deviceGroup, _]);

  // ── Employee search (debounced, enabled only on keystroke) ───────────────

  const [employeeQuery, setEmployeeQuery] = useState("");

  const debouncedSetQuery = useDebouncedCallback(
    (q: string) => setEmployeeQuery(q),
    DEBOUNCE_MS,
  );

  const { data: employeeGroup, isFetching: employeesLoading } = useQuery({
    queryKey: QueryKeys.punches.filters({
      dimension: "employee",
      search: employeeQuery,
      ...context,
    }),
    queryFn: () =>
      fetchPunchFilters({
        dimension: "employee",
        search: employeeQuery,
        ...context,
      }),
    enabled: employeeQuery.length >= MIN_SEARCH_LENGTH,
    staleTime: 30_000,
  });

  const employeeOptions = useMemo(() => {
    return (employeeGroup?.[0]?.options ?? []).map(facetToOption);
  }, [employeeGroup]);

  const resetEmployeeSearch = useCallback(() => {
    setEmployeeQuery("");
  }, []);

  return {
    deviceOptions,
    devicesLoading,
    labelBySn,
    searchEmployees: debouncedSetQuery,
    employeeOptions,
    employeesLoading,
    resetEmployeeSearch,
  };
}

import { useState, useMemo, useCallback } from "react";
import { useLingui } from "@lingui/react";
import { msg } from "@lingui/core/macro";
import { IconPlus } from "@tabler/icons-react";
import { useNavigate } from "react-router-dom";

import { AppRoute } from "@/lib/navigation";
import { useEmployeeList } from "../hooks/use-employee-list";
import { Section, Button, SearchInput, FilterBar, Select, EmptyState } from "@/components/ui";
import { PageHeader } from "@/components/layout";
import { DataTableContainer, createEmployeeColumns } from "@/modules/data-renderer";
import type { Employee } from "@/lib/api/employees";

/**
 * EmployeeListView — searchable, sortable employee directory table.
 *
 * Uses {@link DataTableContainer} (data-renderer) for metadata-driven
 * column rendering via `createEmployeeColumns` and `FieldDisplay`.
 * Search and department filter are client-side.
 */
export function EmployeeListView() {
  const { _ } = useLingui();
  const navigate = useNavigate();
  const query = useEmployeeList();
  const columns = useMemo(() => createEmployeeColumns(_), [_]);

  const [search, setSearch] = useState("");
  const [deptFilter, setDeptFilter] = useState("");

  // ── Department options ────────────────────────────────────────────────

  const departments = useMemo(() => {
    const depts = new Set<string>();
    (query.data ?? []).forEach((e) => {
      if (e.department) depts.add(e.department);
    });
    return Array.from(depts).sort();
  }, [query.data]);

  const deptOptions = useMemo(
    () => [
      { value: "", label: _(msg`All Departments`) },
      ...departments.map((d) => ({ value: d, label: d })),
    ],
    [departments, _],
  );

  // ── Client-side search + filter ───────────────────────────────────────

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

    if (deptFilter) {
      list = list.filter((e) => e.department === deptFilter);
    }

    return list;
  }, [query.data, search, deptFilter]);

  const hasActiveFilters = search.length > 0 || deptFilter.length > 0;
  const hasEmployees = (query.data?.length ?? 0) > 0;

  const handleClearFilters = useCallback(() => {
    setSearch("");
    setDeptFilter("");
  }, []);

  const handleRowClick = useCallback(
    (e: Employee) => navigate(AppRoute.employees.detail(e.id)),
    [navigate],
  );

  return (
    <>
      <PageHeader
        title={_(msg`Employees`)}
        description={_(msg`Manage employee records and view attendance.`)}
        actions={
          <Button to={AppRoute.employees.new} size="sm" icon={<IconPlus size={16} />}>
            {_(msg`Add Employee`)}
          </Button>
        }
      />

      <Section>
        <FilterBar onClear={handleClearFilters} hasActiveFilters={hasActiveFilters}>
          <SearchInput
            placeholder={_(msg`Search by name, PIN, or department…`)}
            value={search}
            onChange={setSearch}
          />
          {departments.length > 0 && (
            <Select
              options={deptOptions}
              value={deptFilter}
              onChange={setDeptFilter}
              label={_(msg`Department`)}
            />
          )}
        </FilterBar>
      </Section>

      <Section>
        <DataTableContainer
          columns={columns}
          data={filtered}
          getRowKey={(e) => e.id}
          entityType="user"
          isLoading={query.isLoading}
          error={query.error?.message ?? null}
          onRetry={() => query.refetch()}
          onRowClick={handleRowClick}
          emptyState={
            hasEmployees ? (
              <EmptyState
                title={_(msg`No employees match`)}
                description={_(msg`Try adjusting or clearing your search and filter.`)}
              />
            ) : (
              <EmptyState
                title={_(msg`No employees`)}
                description={_(msg`Add your first employee to get started.`)}
                action={
                  <Button to={AppRoute.employees.new} icon={<IconPlus size={16} />}>
                    {_(msg`Add Employee`)}
                  </Button>
                }
              />
            )
          }
        />
      </Section>
    </>
  );
}

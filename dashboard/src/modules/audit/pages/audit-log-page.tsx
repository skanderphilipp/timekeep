import { useMemo } from "react";
import { useLingui } from "@lingui/react";
import { msg } from "@lingui/core/macro";

import {
  PageLayout,
  PageBody,
  PageHeader,
  Section,
  DataTable,
  Spinner,
  EmptyState,
  Badge,
  FilterBar,
  FilterInput,
} from "@/components/ui";
import { useListState } from "@/infrastructure/query-params";
import { useAuditLog } from "../hooks/use-audit-log";
import type { AuditEvent, AuditFilter } from "@/lib/api";
import type { DataTableColumn } from "@/components/ui/data-table";
import { DEFAULT_PAGE_SIZE } from "@/lib/constants";

type AuditColumn = "timestamp" | "actor" | "action" | "resource" | "status";

const auditFilterDefaults: Omit<AuditFilter, "limit" | "cursor"> = {
  search: "",
  since: "",
  until: "",
};

export function AuditLogPage() {
  const { _ } = useLingui();

  const {
    filters,
    sort,
    setFilter,
    toggleSort,
    resetFilters,
    hasActiveFilters,
  } = useListState<Omit<AuditFilter, "limit" | "cursor">>({
    namespace: "audit",
    filterDefaults: auditFilterDefaults,
    sortDefaults: { column: "timestamp", direction: "desc" },
  });

  const { data: events, isLoading, error } = useAuditLog({
    ...filters,
    limit: DEFAULT_PAGE_SIZE,
    sort_by: sort?.column,
    sort_order: sort?.direction,
  });

  const columns: DataTableColumn<AuditEvent, AuditColumn>[] = useMemo(
    () => [
      {
        id: "timestamp",
        header: _(msg`Time`),
        accessor: (e) => new Date(e.timestamp * 1000).toLocaleString(),
        sortable: true,
      },
      {
        id: "actor",
        header: _(msg`Actor`),
        accessor: (e) => e.actor,
        sortable: true,
      },
      {
        id: "action",
        header: _(msg`Action`),
        accessor: (e) => e.action,
        sortable: true,
      },
      {
        id: "resource",
        header: _(msg`Resource`),
        accessor: (e) => e.resource,
        sortable: true,
      },
      {
        id: "status",
        header: _(msg`Status`),
        accessor: (e) => e.status,
        cell: (e) => (
          <Badge variant={e.status === "success" ? "success" : "danger"}>
            {e.status}
          </Badge>
        ),
      },
    ],
    [_],
  );

  const items = events ?? [];

  if (isLoading) {
    return (
      <PageLayout>
        <PageBody>
          <PageHeader title={_(msg`Audit Log`)} description={_(msg`Track every authenticated write operation across the system.`)} />
          <Section>
            <Spinner />
          </Section>
        </PageBody>
      </PageLayout>
    );
  }

  return (
    <PageLayout>
      <PageBody>
        <PageHeader
          title={_(msg`Audit Log`)}
          description={_(msg`Track every authenticated write operation across the system.`)}
        />

        <Section>
          <FilterBar onClear={resetFilters} hasActiveFilters={hasActiveFilters}>
            <FilterInput
              placeholder={_(msg`Search actors, actions, resources…`)}
              value={filters.search ?? ""}
              onChange={(v) => setFilter({ search: v })}
            />
          </FilterBar>
        </Section>

        <Section>
          {error ? (
            <EmptyState
              title={_(msg`Failed to load audit log.`)}
              description={_(msg`Is the backend running?`)}
            />
          ) : items.length === 0 ? (
            <EmptyState
              title={_(msg`No audit events`)}
              description={_(msg`Audit events will appear here as users perform actions.`)}
            />
          ) : (
            <DataTable
              columns={columns}
              data={items}
              getRowKey={(e) => e.id}
              sortState={sort ? { column: sort.column, direction: sort.direction } : null}
              onSortChange={(col) => toggleSort(col)}
            />
          )}
        </Section>
      </PageBody>
    </PageLayout>
  );
}

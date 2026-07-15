import { useLingui } from "@lingui/react";
import { msg } from "@lingui/core/macro";

import { useAuditLog } from "../hooks/use-audit-log";
import { AuditLogEmpty } from "../states";
import {
  Section,
  SearchInput,
  FilterBar,
} from "@/components/ui";
import { DataTableContainer } from "@/modules/data-renderer";

/**
 * Audit log view — searchable, sortable audit trail table.
 *
 * Uses {@link DataTableContainer} (data-renderer) for metadata-driven
 * column rendering via `createAuditColumns` and `FieldDisplay`.
 * Sort and search state lives in URL query params via `useListState`.
 */
export function AuditLogView() {
  const { _ } = useLingui();
  const page = useAuditLog();

  return (
    <>
      <Section>
        <FilterBar
          onClear={page.onClearFilters}
          hasActiveFilters={page.hasActiveFilters}
        >
          <SearchInput
            placeholder={_(msg`Search actors, actions, resources…`)}
            value={page.searchValue}
            onChange={page.onSearchChange}
            debounceMs={300}
          />
        </FilterBar>
      </Section>

      <Section>
        <DataTableContainer
          columns={page.columns}
          data={page.data}
          getRowKey={page.getRowKey}
          entityType="audit"
          isLoading={page.isLoading}
          error={page.error}
          onRetry={page.onRetry}
          externalSortState={page.sortState}
          onSortChange={page.onSortChange}
          emptyState={<AuditLogEmpty />}
        />
      </Section>
    </>
  );
}

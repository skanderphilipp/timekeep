import { useMemo, useCallback, type ReactNode } from "react";
import { DataTableContext } from "../contexts/data-table-context";
import { DataTableFooter } from "./data-table-footer";
import { createEditableCellRenderer, type CellEditingConfig } from "./create-editable-cell-renderer";
import { useTableSort } from "../hooks/use-table-sort";
import { useTableFilter } from "../hooks/use-table-filter";
import { useTableInstanceId, useCellClickHandler } from "../hooks/use-cell-click-handler";
import { useInfiniteScrollSentinel } from "../hooks/use-infinite-scroll-sentinel";
import { DataTable, InfiniteScrollSentinel, Spinner, Text, type DataTableColumn } from "@/components/ui";
import { msg } from "@lingui/core/macro";
import { useLingui } from "@lingui/react";
import type { ColumnDefinition, FieldMetadata, EntityType, PaginationState } from "../types";

// ── Props ──────────────────────────────────────────────────────────────────

type DataTableContainerProps<T extends Record<string, unknown>> = {
  columns: ColumnDefinition<FieldMetadata>[];
  data: T[];
  getRowKey: (row: T) => string;
  entityType: EntityType;
  isLoading?: boolean;
  loadingRowCount?: number;
  emptyState?: ReactNode;
  externalSortState?: { column: string; direction: "asc" | "desc" } | null;
  onSortChange?: (columnId: string) => void;
  pagination?: PaginationState;
  onPageChange?: (page: number) => void;
  selectedRowCount?: number;
  onRowClick?: (row: T) => void;
  className?: string;
  infiniteScroll?: {
    hasNextPage: boolean;
    isFetchingNextPage: boolean;
    fetchNextPage: () => void;
  };
  /**
   * Inline editing configuration. When provided, columns marked `editable: true`
   * become click-to-edit cells with Tab navigation.
   *
   * @example
   * ```ts
   * <DataTableContainer
   *   editingConfig={{
   *     onPersist: (rowId, field, value) => editMutation.mutate({ rowId, field, value }),
   *     editableColumns: ["name", "department"],
   *   }}
   * />
   * ```
   */
  editingConfig?: CellEditingConfig;
};

// ── Component ──────────────────────────────────────────────────────────────

/**
 * DataTableContainer — bridges the data-renderer architecture onto the
 * existing DataTable component.
 *
 * Converts ColumnDefinition[] → DataTableColumn[] via createEditableCellRenderer,
 * injects the context hierarchy, handles entity routing on cell clicks,
 * and adds infinite scroll / pagination support.
 *
 * When `editingConfig` is provided, columns with `editable: true` become
 * inline-editable (Phase 4).
 */
export function DataTableContainer<T extends Record<string, unknown>>({
  columns,
  data,
  getRowKey,
  entityType,
  isLoading = false,
  loadingRowCount = 5,
  emptyState,
  externalSortState,
  onSortChange: externalOnSortChange,
  pagination,
  onPageChange,
  selectedRowCount,
  onRowClick,
  className,
  infiniteScroll,
  editingConfig,
}: DataTableContainerProps<T>) {
  const { _ } = useLingui();
  const instanceId = useTableInstanceId();
  const handleCellClick = useCellClickHandler();
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { sorts: _internalSorts, toggleSort: _internalToggleSort } = useTableSort(instanceId);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { filters: _filters } = useTableFilter(instanceId);

  const onCellClick = useCallback(
    (columnId: string, recordId: string) => {
      const col = columns.find((c) => c.id === columnId);
      if (!col) return;
      switch (col.type) {
        case "device_sn":
          handleCellClick("device", recordId);
          break;
        case "employee_name":
          handleCellClick("user", recordId);
          break;
        default:
          handleCellClick(entityType, recordId);
          break;
      }
    },
    [columns, handleCellClick, entityType],
  );

  // Convert ColumnDefinition[] → DataTableColumn[]
  const tableColumns: DataTableColumn<T>[] = useMemo(
    () =>
      columns
        .filter((col) => col.isVisible !== false)
        .map(
          (col): DataTableColumn<T> => ({
            id: col.id,
            header: col.header,
            sortable: col.metadata?.isSortable ?? false,
            width: col.width,
            cellClassName: col.cellClassName,
            cell: createEditableCellRenderer(col, onCellClick, getRowKey, editingConfig),
          }),
        ),
    [columns, onCellClick, getRowKey, editingConfig],
  );

  const sortState = externalSortState
    ? { column: externalSortState.column, direction: externalSortState.direction as "asc" | "desc" }
    : null;

  const tableContextValue = useMemo(
    () => ({
      instanceId,
      entityType,
      onCellClick: handleCellClick,
      triggerEvent: "CLICK" as const,
    }),
    [instanceId, entityType, handleCellClick],
  );

  // Infinite scroll sentinel
  const sentinelRef = useInfiniteScrollSentinel({
    onIntersect: () => {
      if (infiniteScroll?.hasNextPage && !infiniteScroll?.isFetchingNextPage) {
        infiniteScroll.fetchNextPage();
      }
    },
    enabled: !!infiniteScroll && infiniteScroll.hasNextPage,
  });

  return (
    <DataTableContext.Provider value={tableContextValue}>
      <DataTable
        columns={tableColumns}
        data={data}
        getRowKey={getRowKey}
        onRowClick={onRowClick}
        isLoading={isLoading}
        loadingRowCount={loadingRowCount}
        emptyState={emptyState}
        sortState={sortState}
        onSortChange={externalOnSortChange}
        className={className}
      />

      {pagination && onPageChange && (
        <DataTableFooter
          totalRows={pagination.total}
          currentPage={pagination.page}
          totalPages={Math.max(1, Math.ceil(pagination.total / pagination.pageSize))}
          onPageChange={onPageChange}
          selectedCount={selectedRowCount}
        />
      )}

      {infiniteScroll && (
        <InfiniteScrollSentinel ref={sentinelRef}>
          {infiniteScroll.isFetchingNextPage ? (
            <Spinner />
          ) : infiniteScroll.hasNextPage ? (
            <Text variant="caption" color="tertiary">
              {_(msg`Scroll for more`)}
            </Text>
          ) : data.length > 0 ? (
            <Text variant="caption" color="tertiary">
              {_(msg`All records loaded`)}
            </Text>
          ) : null}
        </InfiniteScrollSentinel>
      )}
    </DataTableContext.Provider>
  );
}

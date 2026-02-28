import { clsx } from "clsx";
import { useCallback, type ReactNode } from "react";
import { IconArrowUp, IconArrowDown, IconSelector } from "@tabler/icons-react";

import styles from "./data-table.module.scss";

// ── Types ────────────────────────────────────────────────────────────────────

export type SortDirection = "asc" | "desc";

export type SortState = {
  column: string;
  direction: SortDirection;
};

export type DataTableColumn<T, K extends string = string> = {
  /** Unique column identifier. Used for sorting key. */
  id: K;
  /** Column header text. */
  header: string;
  /** Simple accessor for text-only cells. Use `cell` for richer content. */
  accessor?: (row: T) => string;
  /** Custom cell renderer. Takes precedence over `accessor`. */
  cell?: (row: T) => ReactNode;
  /** Whether this column is sortable. */
  sortable?: boolean;
  /** Fixed column width (e.g., "120px" or "10%"). */
  width?: string;
  /** Additional CSS class for cells in this column. */
  cellClassName?: string;
};

type DataTableProps<T, K extends string = string> = {
  /** Column definitions. */
  columns: DataTableColumn<T, K>[];
  /** Row data. */
  data: T[];
  /** Stable unique key per row (used for React key and row identity). */
  getRowKey: (row: T) => string;
  /** Called when a row is clicked. */
  onRowClick?: (row: T) => void;
  /** Whether data is currently loading. Shows skeleton rows. */
  isLoading?: boolean;
  /** Number of skeleton rows to show during loading. */
  loadingRowCount?: number;
  /** Rendered when data is empty and not loading. */
  emptyState?: ReactNode;
  /** Current sort state (controlled). */
  sortState?: SortState | null;
  /** Called when a sortable column header is clicked. */
  onSortChange?: (columnId: K) => void;
  /** Enables sticky header when the table body scrolls. */
  stickyHeader?: boolean;
  className?: string;
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function SortIcon({ direction }: { direction: SortDirection | null }) {
  if (direction === "asc") {
    return <IconArrowUp data-slot="sort-icon-asc" size={14} className={styles.sortIconActive} />;
  }
  if (direction === "desc") {
    return <IconArrowDown data-slot="sort-icon-desc" size={14} className={styles.sortIconActive} />;
  }
  return <IconSelector data-slot="sort-icon-neutral" size={14} className={styles.sortIcon} />;
}

// ── Component ────────────────────────────────────────────────────────────────

export function DataTable<T, K extends string = string>({
  columns,
  data,
  getRowKey,
  onRowClick,
  isLoading = false,
  loadingRowCount = 5,
  emptyState,
  sortState,
  onSortChange,
  stickyHeader = false,
  className,
}: DataTableProps<T, K>) {
  const handleSortClick = useCallback(
    (columnId: K) => {
      if (onSortChange) onSortChange(columnId);
    },
    [onSortChange],
  );

  const isClickable = !!onRowClick;

  return (
    <div data-slot="data-table" className={clsx(styles.wrapper, stickyHeader && styles.stickyHeader, className)}>
      <table data-slot="data-table-element" className={styles.table}>
        <thead data-slot="data-table-head">
          <tr data-slot="data-table-head-row">
            {columns.map((col) => {
              const isSorted = sortState?.column === col.id;
              const sortDir = isSorted ? sortState!.direction : null;
              const canSort = col.sortable && onSortChange;

              return (
                <th
                  key={col.id}
                  data-slot="data-table-th"
                  data-column={col.id}
                  data-sortable={canSort || undefined}
                  data-sorted={sortDir || undefined}
                  style={col.width ? { width: col.width } : undefined}
                  className={clsx(canSort && styles.sortable)}
                  onClick={canSort ? () => handleSortClick(col.id) : undefined}
                  onKeyDown={
                    canSort
                      ? (e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            handleSortClick(col.id);
                          }
                        }
                      : undefined
                  }
                  tabIndex={canSort ? 0 : undefined}
                  role="columnheader"
                  aria-sort={
                    sortDir === "asc"
                      ? "ascending"
                      : sortDir === "desc"
                        ? "descending"
                        : undefined
                  }
                >
                  <span data-slot="data-table-th-content" className={styles.thContent}>
                    {col.header}
                    {canSort && <SortIcon direction={sortDir} />}
                  </span>
                </th>
              );
            })}
          </tr>
        </thead>

        <tbody data-slot="data-table-body">
          {isLoading &&
            Array.from({ length: loadingRowCount }).map((_, i) => (
              <tr key={`skeleton-${i}`} data-slot="data-table-skeleton-row">
                {columns.map((col) => (
                  <td key={col.id} data-slot="data-table-skeleton-cell">
                    <span className={styles.skeleton}>&nbsp;</span>
                  </td>
                ))}
              </tr>
            ))}

          {!isLoading &&
            data.length === 0 &&
            emptyState && (
              <tr data-slot="data-table-empty-row">
                <td
                  data-slot="data-table-empty-cell"
                  colSpan={columns.length}
                  className={styles.emptyCell}
                >
                  {emptyState}
                </td>
              </tr>
            )}

          {!isLoading &&
            data.map((row) => (
              <tr
                key={getRowKey(row)}
                data-slot="data-table-row"
                data-clickable={isClickable || undefined}
                className={clsx(isClickable && styles.clickableRow)}
                onClick={isClickable ? () => onRowClick!(row) : undefined}
                onKeyDown={
                  isClickable
                    ? (e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          onRowClick!(row);
                        }
                      }
                    : undefined
                }
                tabIndex={isClickable ? 0 : undefined}
              >
                {columns.map((col) => (
                  <td
                    key={col.id}
                    data-slot="data-table-td"
                    data-column={col.id}
                    className={col.cellClassName}
                  >
                    {col.cell
                      ? col.cell(row)
                      : col.accessor
                        ? col.accessor(row)
                        : null}
                  </td>
                ))}
              </tr>
            ))}
        </tbody>
      </table>
    </div>
  );
}

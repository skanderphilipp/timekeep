import { Pagination } from "@/components/ui/pagination";
import { Text } from "@/components/ui/text";
import { msg } from "@lingui/core/macro";
import { useLingui } from "@lingui/react";
import styles from "./data-table-footer.module.scss";

type DataTableFooterProps = {
  /** Total number of rows across all pages. */
  totalRows: number;
  /** Current page (1-based). */
  currentPage: number;
  /** Total number of pages. */
  totalPages: number;
  /** Called when the user navigates to a different page. */
  onPageChange: (page: number) => void;
  /** Number of selected rows (for selection mode). */
  selectedCount?: number;
};

/**
 * Data table footer — pagination controls + row count summary.
 *
 * Only renders when there are multiple pages.
 * Uses the existing `Pagination` UI component and project SCSS modules.
 */
export function DataTableFooter({
  totalRows,
  currentPage,
  totalPages,
  onPageChange,
  selectedCount,
}: DataTableFooterProps) {
  const { _ } = useLingui();

  if (totalPages <= 1) return null;

  return (
    <section data-slot="data-table-footer" className={styles.footer}>
      <Text variant="caption" color="tertiary">
        {selectedCount != null && selectedCount > 0
          ? _(msg`${selectedCount} of ${totalRows} selected`)
          : _(msg`${totalRows} rows`)}
      </Text>

      <Pagination
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={onPageChange}
      />
    </section>
  );
}

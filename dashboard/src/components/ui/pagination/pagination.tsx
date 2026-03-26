import { clsx } from "clsx";
import { msg } from "@lingui/core/macro";
import { useLingui } from "@lingui/react";
import { useDirection } from "@/hooks/use-direction";
import { chevronForDirection } from "@/lib/icon-flip";

import styles from "./pagination.module.scss";

type PaginationProps = {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  className?: string;
};

export function Pagination({
  currentPage,
  totalPages,
  onPageChange,
  className,
}: PaginationProps) {
  const { _ } = useLingui();
  const dir = useDirection();
  const PrevIcon = chevronForDirection(dir, false);
  const NextIcon = chevronForDirection(dir, true);

  if (totalPages <= 1) return null;

  const pages = getVisiblePages(currentPage, totalPages);

  return (
    <nav
      data-slot="pagination"
      className={clsx(styles.container, className)}
      aria-label={_(msg`Pagination`)}
    >
      <button
        data-slot="pagination-prev"
        className={styles.button}
        disabled={currentPage === 1}
        onClick={() => onPageChange(currentPage - 1)}
        aria-label={_(msg`Previous page`)}
      >
        <PrevIcon size={16} />
      </button>

      {pages.map((page, i) =>
        page === null ? (
          <span
            data-slot="pagination-ellipsis"
            key={`ellipsis-${i}`}
            className={styles.ellipsis}
          >
            …
          </span>
        ) : (
          <button
            data-slot="pagination-page"
            key={page}
            className={clsx(styles.button, page === currentPage && styles.active)}
            onClick={() => onPageChange(page)}
            aria-current={page === currentPage ? "page" : undefined}
          >
            {page}
          </button>
        ),
      )}

      <button
        data-slot="pagination-next"
        className={styles.button}
        disabled={currentPage === totalPages}
        onClick={() => onPageChange(currentPage + 1)}
        aria-label={_(msg`Next page`)}
      >
        <NextIcon size={16} />
      </button>
    </nav>
  );
}

/** Generate visible page numbers with ellipsis for large page counts. */
function getVisiblePages(current: number, total: number): (number | null)[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);

  const pages: (number | null)[] = [1];

  if (current > 3) pages.push(null);

  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);

  for (let i = start; i <= end; i++) pages.push(i);

  if (current < total - 2) pages.push(null);

  pages.push(total);

  return pages;
}

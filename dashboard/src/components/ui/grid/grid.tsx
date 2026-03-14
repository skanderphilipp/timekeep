import type { ReactNode } from "react";
import styles from "./grid.module.scss";

type GridProps = {
  children: ReactNode;
  /** Number of columns or "auto" for auto-fit. */
  cols?: 2 | "auto";
};

/**
 * Responsive CSS grid layout for side-by-side content.
 *
 * Use for chart pairs, stat grids, or any multi-column layout.
 * `cols={2}` creates a two-column layout that collapses on mobile.
 * `cols="auto"` creates an auto-fitting grid with minimum 280px items.
 *
 * @example
 * ```tsx
 * <Grid cols={2}>
 *   <Chart>...</Chart>
 *   <Chart>...</Chart>
 * </Grid>
 * ```
 */
export function Grid({ children, cols = "auto" }: GridProps) {
  return (
    <div data-slot="grid" data-cols={cols} className={styles.grid}>
      {children}
    </div>
  );
}

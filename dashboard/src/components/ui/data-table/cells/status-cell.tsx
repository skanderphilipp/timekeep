import { clsx } from "clsx";

import { StatusDot } from "../../status-dot";

import styles from "./cells.module.scss";

export type StatusCellProps = {
  /** Status variant matching our StatusDot component. */
  status: "online" | "offline" | "warning";
  /** Display label. */
  label: string;
  className?: string;
};

/**
 * Status indicator cell. Combines a StatusDot with a text label.
 * Used for punch status (Present, Late, Absent, etc.).
 */
export function StatusCell({ status, label, className }: StatusCellProps) {
  return (
    <span data-slot="status-cell" className={clsx(styles.status, className)}>
      <StatusDot status={status} />
      <span className={styles.statusLabel}>{label}</span>
    </span>
  );
}

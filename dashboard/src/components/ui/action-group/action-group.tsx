import type { ReactNode } from "react";

import { clsx } from "clsx";

import styles from "./action-group.module.scss";

type ActionGroupProps = {
  children: ReactNode;
  className?: string;
};

/**
 * Inline button group for DataTable action cells and toolbar actions.
 *
 * Replaces raw `<div style={{display:"flex",gap:"0.25rem"}}>` for grouping
 * IconButtons in table row action columns.
 *
 * @example
 * ```tsx
 * <ActionGroup>
 *   <IconButton onClick={handleEdit}><IconPencil /></IconButton>
 *   <IconButton onClick={handleDelete}><IconTrash /></IconButton>
 * </ActionGroup>
 * ```
 */
export function ActionGroup({ children, className }: ActionGroupProps) {
  return (
    <div data-slot="action-group" className={clsx(styles.group, className)}>
      {children}
    </div>
  );
}

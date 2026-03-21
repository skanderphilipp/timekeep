import type { ReactNode } from "react";

import styles from "./list-item.module.scss";

type ListItemProps = {
  children: ReactNode;
};

/**
 * A two-column list item with a leading and trailing section, separated by a border.
 *
 * Replaces raw `<div style={{display:flex,justifyContent:space-between,borderBottom}}>`
 * in activity feeds and similar lists.
 *
 * @example
 * ```tsx
 * {events.map(event => (
 *   <ListItem key={event.id}>
 *     <ListItem.Leading>
 *       <Text variant="body" weight="medium">{event.name}</Text>
 *       <Text variant="caption" color="tertiary">{event.device}</Text>
 *     </ListItem.Leading>
 *     <ListItem.Trailing>
 *       <Badge variant="neutral">{event.status}</Badge>
 *       <Text variant="caption" color="tertiary">{event.time}</Text>
 *     </ListItem.Trailing>
 *   </ListItem>
 * ))}
 * ```
 */
export function ListItem({ children }: ListItemProps) {
  return (
    <div data-slot="list-item" className={styles.item}>
      {children}
    </div>
  );
}

function Leading({ children }: { children: ReactNode }) {
  return (
    <div data-slot="list-item-leading" className={styles.leading}>
      {children}
    </div>
  );
}

function Trailing({ children }: { children: ReactNode }) {
  return (
    <div data-slot="list-item-trailing" className={styles.trailing}>
      {children}
    </div>
  );
}

ListItem.Leading = Leading;
ListItem.Trailing = Trailing;

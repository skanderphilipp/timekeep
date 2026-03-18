import type { ReactNode } from "react";

import { Heading } from "../heading/heading";
import styles from "./inline-header.module.scss";

type InlineHeaderProps = {
  /** Icon rendered before the title (16-20px Tabler icon). */
  icon?: ReactNode;
  /** Card/tile title. Rendered as `<Heading level="h3">`. */
  title: string;
  /** Optional trailing content (badges, buttons) rendered after the title. */
  children?: ReactNode;
};

/**
 * Inline header row for card content — icon + title + trailing elements.
 *
 * Replaces raw `<div style={{display:flex,alignItems:center,gap}}>` with
 * icon + `<Heading>` + trailing badges inside card bodies.
 *
 * @example
 * ```tsx
 * <Card>
 *   <Card.Content>
 *     <InlineHeader icon={<IconDeviceDesktop size={20} />} title="Device Name">
 *       <Badge variant="success">Online</Badge>
 *     </InlineHeader>
 *     <Text variant="caption">SN: ABC123</Text>
 *   </Card.Content>
 * </Card>
 * ```
 */
export function InlineHeader({ icon, title, children }: InlineHeaderProps) {
  return (
    <div data-slot="inline-header" className={styles.row}>
      {icon && <span data-slot="inline-header-icon" className={styles.icon}>{icon}</span>}
      <span data-slot="inline-header-title" className={styles.title}>
        <Heading level="h3">{title}</Heading>
      </span>
      {children && (
        <span data-slot="inline-header-children" className={styles.children}>
          {children}
        </span>
      )}
    </div>
  );
}

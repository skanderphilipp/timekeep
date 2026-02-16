import { clsx } from "clsx";
import { type ReactNode } from "react";
import {
  IconSearch,
  IconFileDescription,
  IconUsers,
  IconCalendarEvent,
  IconDeviceDesktop,
  IconMoodEmpty,
  type Icon as TablerIcon,
} from "@tabler/icons-react";

import styles from "./animated-placeholder.module.scss";

/**
 * Predefined placeholder types with matching icons.
 * Extend as needed for application-specific empty/error states.
 */
export type AnimatedPlaceholderType =
  | "search"
  | "empty"
  | "users"
  | "calendar"
  | "devices"
  | "noResults";

const ICON_MAP: Record<AnimatedPlaceholderType, TablerIcon> = {
  search: IconSearch,
  empty: IconFileDescription,
  users: IconUsers,
  calendar: IconCalendarEvent,
  devices: IconDeviceDesktop,
  noResults: IconMoodEmpty,
};

export type AnimatedPlaceholderProps = {
  /** Predefined placeholder type, or custom children override. */
  type?: AnimatedPlaceholderType;
  /** Override the default icon. */
  Icon?: TablerIcon;
  /** Heading shown below the icon. */
  title?: string;
  /** Description text below the heading. */
  description?: string;
  /** Custom content (overrides icon/title/description). */
  children?: ReactNode;
  className?: string;
};

export function AnimatedPlaceholder({
  type,
  Icon,
  title,
  description,
  children,
  className,
}: AnimatedPlaceholderProps) {
  if (children) {
    return (
      <div
        data-slot="animated-placeholder"
        className={clsx(styles.container, className)}
      >
        {children}
      </div>
    );
  }

  const ResolvedIcon = Icon ?? (type ? ICON_MAP[type] : IconFileDescription);

  return (
    <div
      data-slot="animated-placeholder"
      className={clsx(styles.container, className)}
    >
      <span className={styles.iconWrapper} aria-hidden="true">
        <ResolvedIcon size={48} stroke={1.5} className={styles.icon} />
      </span>
      {title && <p className={styles.title}>{title}</p>}
      {description && <p className={styles.description}>{description}</p>}
    </div>
  );
}

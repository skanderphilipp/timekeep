import type { ReactNode } from "react";

import styles from "./ComponentDecorator.module.scss";

/**
 * Centers a UI component in a padded container for isolated visual inspection.
 *
 * Apply as a decorator in story meta or individual stories:
 *
 * @example
 *   export default {
 *     decorators: [ComponentDecorator],
 *   } satisfies Meta<typeof MyComponent>;
 *
 * Adapted from Twenty's ComponentDecorator pattern.
 */
export function ComponentDecorator({ children }: { children: ReactNode }) {
  return <div className={styles.container}>{children}</div>;
}

import type { ReactNode } from "react";

import styles from "./CatalogDecorator.module.scss";

/**
 * Renders a component in a grid showing all its variant/state combinations.
 *
 * Used with the CatalogStory type from "../types/CatalogStory".
 * Configure via `parameters.catalog` in the story:
 *
 * @example
 *   parameters: {
 *     catalog: {
 *       dimensions: [
 *         {
 *           name: 'variant',
 *           values: ['primary', 'secondary'],
 *           props: (variant) => ({ variant }),
 *         },
 *         {
 *           name: 'disabled',
 *           values: [false, true],
 *           props: (disabled) => ({ disabled }),
 *         },
 *       ],
 *     },
 *   }
 *
 * Adapted from CatalogDecorator pattern.
 */
export function CatalogDecorator({ children }: { children: ReactNode }) {
  return <div className={styles.grid}>{children}</div>;
}

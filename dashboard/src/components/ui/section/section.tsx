import { clsx } from "clsx";
import type { ReactNode } from "react";

import styles from "./section.module.scss";

type SectionProps = {
  children: ReactNode;
  className?: string;
  /** Horizontal alignment of the section content. */
  alignment?: "left" | "center";
};

/**
 * Page-level layout container.
 *
 * Sections provide consistent horizontal padding, max-width, and vertical rhythm.
 * Use a Section for each major content block on a page.
 *
 * Pages should compose multiple Sections — never nest raw divs as layout containers.
 */
export function Section({ children, className, alignment = "left" }: SectionProps) {
  return (
    <section
      data-slot="section"
      data-alignment={alignment}
      className={clsx(styles.section, styles[alignment], className)}
    >
      {children}
    </section>
  );
}

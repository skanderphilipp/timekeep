import { clsx } from "clsx";
import type { ReactNode } from "react";

import styles from "./form.module.scss";

type FormSectionProps = {
  /** Section heading. */
  title: string;
  /** Optional description below the heading. */
  description?: string;
  /** Form fields. */
  children: ReactNode;
  className?: string;
};

/**
 * Titled group of related form fields.
 *
 * Use to break long forms into logical sections (e.g., "Device Identity",
 * "Connection Settings"). Renders a heading with optional description.
 */
export function FormSection({
  title,
  description,
  children,
  className,
}: FormSectionProps) {
  return (
    <fieldset data-slot="form-section" className={clsx(styles.section, className)}>
      <legend data-slot="form-section-legend" className={styles.sectionLegend}>
        <h3 data-slot="form-section-title" className={styles.sectionTitle}>
          {title}
        </h3>
        {description && (
          <p data-slot="form-section-description" className={styles.sectionDescription}>
            {description}
          </p>
        )}
      </legend>
      <div data-slot="form-section-fields" className={styles.sectionFields}>
        {children}
      </div>
    </fieldset>
  );
}

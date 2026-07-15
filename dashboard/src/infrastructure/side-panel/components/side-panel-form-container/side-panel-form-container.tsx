import { type ReactNode } from "react";
import { clsx } from "clsx";
import { useLingui } from "@lingui/react";
import { msg } from "@lingui/core/macro";

import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Banner } from "@/components/ui/banner";

import styles from "./side-panel-form-container.module.scss";

// ── Types ──────────────────────────────────────────────────────────────────

type SidePanelFormContainerProps = {
  /** Form title displayed at the top. */
  title: string;
  /** Optional description below the title. */
  description?: string;
  /** The form content (SchemaForm, custom fields, etc.). */
  children: ReactNode;
  /** Called when the user clicks Cancel. */
  onCancel: () => void;
  /** Whether the form is currently saving. Disables the Save button. */
  isPending?: boolean;
  /** Error message to display as a banner. */
  error?: string | null;
  /** Whether the form data is still loading (e.g., for edit mode). */
  isLoading?: boolean;
  /** Custom label for the save button. Defaults to "Save". */
  saveLabel?: string;
  /** Additional CSS class. */
  className?: string;
};

// ── Component ──────────────────────────────────────────────────────────────

/**
 * Reusable form container for the side panel.
 *
 * Provides consistent header, loading/error states, content area,
 * and a sticky footer with Cancel + Save buttons. This is the
 * side-panel equivalent of Dialog + Form content — designed to
 * replace dialog-based editing with in-panel editing.
 *
 * @example
 * ```tsx
 * <SidePanelFormContainer
 *   title="Edit Department"
 *   isPending={isSaving}
 *   isLoading={isLoadingDepartment}
 *   onCancel={closePanel}
 * >
 *   <SchemaForm formSchema={formSchema} form={form} />
 * </SidePanelFormContainer>
 * ```
 */
export function SidePanelFormContainer({
  title,
  description,
  children,
  onCancel,
  isPending = false,
  error = null,
  isLoading = false,
  saveLabel,
  className,
}: SidePanelFormContainerProps) {
  const { _ } = useLingui();
  const resolvedSaveLabel = saveLabel ?? _(msg`Save`);

  // ── Loading state ──
  if (isLoading) {
    return (
      <div className={clsx(styles.container, className)}>
        <div className={styles.header}>
          <h3 className={styles.title}>{title}</h3>
        </div>
        <div className={styles.loadingContainer}>
          <Spinner />
        </div>
      </div>
    );
  }

  return (
    <div className={clsx(styles.container, className)}>
      {/* Header */}
      <div className={styles.header}>
        <h3 className={styles.title}>{title}</h3>
        {description && <p className={styles.description}>{description}</p>}
      </div>

      {/* Error banner */}
      {error && (
        <div className={styles.errorBanner}>
          <Banner variant="danger">{error}</Banner>
        </div>
      )}

      {/* Form content */}
      <div className={styles.content}>
        {children}
      </div>

      {/* Sticky footer */}
      <div className={styles.footer}>
        <Button variant="secondary" onClick={onCancel} disabled={isPending}>
          {_(msg`Cancel`)}
        </Button>
        <Button type="submit" form="side-panel-form" loading={isPending}>
          {resolvedSaveLabel}
        </Button>
      </div>
    </div>
  );
}

SidePanelFormContainer.displayName = "SidePanelFormContainer";

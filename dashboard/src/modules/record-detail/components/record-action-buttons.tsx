import { useState, useCallback } from "react";
import { useLingui } from "@lingui/react";
import { msg } from "@lingui/core/macro";

import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import type { ActionPlacement, RecordAction } from "../entity-definitions/types";
import styles from "./record-detail.module.scss";

type RecordActionButtonsProps = {
  actions: RecordAction[];
  /**
   * Which actions to show:
   * - "header" — only header-placed + both-placed actions
   * - "footer" — only footer-placed + both-placed actions
   * - "both"   — ALL actions regardless of placement (used in side panel footer)
   */
  placement: ActionPlacement;
};

/**
 * Renders a row of action buttons with optional confirmation dialogs.
 *
 * Actions with `confirm` will show a {@link ConfirmDialog} before executing.
 * Actions with `loading: true` will show a spinner.
 */
export function RecordActionButtons({ actions, placement }: RecordActionButtonsProps) {
  const filtered =
    placement === "both"
      ? actions
      : actions.filter((a) => a.placement === placement || a.placement === "both");

  if (filtered.length === 0) return null;

  return (
    <div data-slot="record-actions" className={styles.actionButtonGroup}>
      {filtered.map((action) => (
        <ActionButton key={action.id} action={action} />
      ))}
    </div>
  );
}

// ── Single action button with optional confirm dialog ──────────────────────

function ActionButton({ action }: { action: RecordAction }) {
  const { _ } = useLingui();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [isPending, setIsPending] = useState(false);

  const handleClick = useCallback(() => {
    if (action.confirm) {
      setConfirmOpen(true);
    } else {
      action.action();
    }
  }, [action]);

  const handleConfirm = useCallback(async () => {
    setIsPending(true);
    try {
      await action.action();
    } finally {
      setIsPending(false);
      setConfirmOpen(false);
    }
  }, [action]);

  const isLoading = action.loading ?? isPending;

  return (
    <>
      <Button
        variant={action.variant === "danger" ? "primary" : (action.variant ?? "secondary")}
        size="sm"
        icon={action.icon ? <action.icon size={16} /> : undefined}
        onClick={handleClick}
        disabled={action.disabled}
        loading={isLoading}
        /**
         * TODO(ENTERPRISE): Add danger variant to Button component.
         *
         * Phase: Polish (before v1.0)
         * Impact: Danger actions currently use primary variant (blue instead of red).
         * Fix: Add variant="danger" to Button that renders with
         *       --ao-status-danger-solid background + white text.
         */
      >
        {action.label}
      </Button>

      {action.confirm && (
        <ConfirmDialog
          open={confirmOpen}
          onOpenChange={setConfirmOpen}
          title={action.confirm.title}
          message={action.confirm.message}
          confirmLabel={_(msg`Confirm`)}
          cancelLabel={_(msg`Cancel`)}
          variant={action.variant === "danger" ? "danger" : "default"}
          isPending={isPending}
          onConfirm={handleConfirm}
        />
      )}
    </>
  );
}

ActionButton.displayName = "ActionButton";

import { Button, FormActions } from "../index";
import { Dialog } from "../dialog";

type ConfirmDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** "danger" shows a red confirm button for destructive actions. */
  variant?: "default" | "danger";
  isPending?: boolean;
  onConfirm: () => void;
};

/**
 * Reusable confirmation dialog.
 *
 * Replaces `window.confirm()` with a proper modal that matches the
 * design system. Used for delete confirmations, revoke actions, etc.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "default",
  isPending = false,
  onConfirm,
}: ConfirmDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange} title={title} description={message}>
      <FormActions>
        <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={isPending}>
          {cancelLabel}
        </Button>
        <Button
          variant={variant === "danger" ? "danger" : "primary"}
          onClick={onConfirm}
          loading={isPending}
        >
          {confirmLabel}
        </Button>
      </FormActions>
    </Dialog>
  );
}

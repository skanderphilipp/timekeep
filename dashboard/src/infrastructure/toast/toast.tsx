/**
 * Toast / Snackbar notification system.
 *
 * Adapted from Reaktly's snack-bar-manager pattern.
 * Centralized state via React Context. Stack multiple toasts. Auto-dismiss.
 */
import {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
  useEffect,
} from "react";
import { clsx } from "clsx";
import { IconX, IconCheck, IconAlertTriangle, IconInfoCircle } from "@tabler/icons-react";
import { useLingui } from "@lingui/react";
import { msg } from "@lingui/core/macro";

import styles from "./toast.module.scss";

type ToastVariant = "success" | "error" | "warning" | "info";

type Toast = {
  id: string;
  message: string;
  variant: ToastVariant;
  duration?: number;
};

type ToastContextType = {
  success: (message: string) => void;
  error: (message: string) => void;
  warning: (message: string) => void;
  info: (message: string) => void;
};

const ToastContext = createContext<ToastContextType | null>(null);

const ICONS: Record<ToastVariant, typeof IconCheck> = {
  success: IconCheck,
  error: IconAlertTriangle,
  warning: IconAlertTriangle,
  info: IconInfoCircle,
};

const idCounter = { current: 0 };

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const add = useCallback((message: string, variant: ToastVariant) => {
    const id = `toast-${++idCounter.current}-${Date.now()}`;
    setToasts((prev) => [...prev, { id, message, variant, duration: variant === "error" ? 8000 : 4000 }]);
  }, []);

  const remove = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const ctx: ToastContextType = {
    success: useCallback((msg: string) => add(msg, "success"), [add]),
    error: useCallback((msg: string) => add(msg, "error"), [add]),
    warning: useCallback((msg: string) => add(msg, "warning"), [add]),
    info: useCallback((msg: string) => add(msg, "info"), [add]),
  };

  return (
    <ToastContext.Provider value={ctx}>
      {children}
      <div data-slot="toast-container" className={styles.container} aria-live="polite">
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onDismiss={() => remove(toast.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: () => void }) {
  const { _ } = useLingui();

  useEffect(() => {
    const timer = setTimeout(onDismiss, toast.duration ?? 4000);
    return () => clearTimeout(timer);
  }, [toast.duration, onDismiss]);

  const Icon = ICONS[toast.variant];

  return (
    <div
      data-slot="toast"
      data-variant={toast.variant}
      className={clsx(styles.toast, styles[toast.variant])}
      role="alert"
    >
      <Icon data-slot="toast-icon" size={18} className={styles.icon} />
      <span data-slot="toast-message" className={styles.message}>{toast.message}</span>
      <button
        data-slot="toast-dismiss"
        className={styles.dismiss}
        onClick={onDismiss}
        aria-label={_(msg`Dismiss`)}
      >
        <IconX size={14} />
      </button>
    </div>
  );
}

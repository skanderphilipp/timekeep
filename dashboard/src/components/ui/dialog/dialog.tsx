import { Dialog } from "@base-ui/react/dialog";
import { clsx } from "clsx";
import type { ReactNode } from "react";
import { IconX } from "@tabler/icons-react";
import { msg } from "@lingui/core/macro";
import { useLingui } from "@lingui/react";
import { AnimatePresence, motion } from "framer-motion";

import styles from "./dialog.module.scss";

type DialogComponentProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  description?: string;
  children: ReactNode;
  className?: string;
};

export function DialogComponent({
  open,
  onOpenChange,
  title,
  description,
  children,
  className,
}: DialogComponentProps) {
  const { _ } = useLingui();

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <AnimatePresence>
        {open && (
          <Dialog.Portal>
            {/* Backdrop: framer-motion handles fade animation; CSS handles positioning */}
            <Dialog.Backdrop
              data-slot="dialog-backdrop"
              className={styles.backdrop}
              render={
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.15 }}
                />
              }
            />

            {/* Popup: framer-motion handles enter/exit animation; CSS handles centering */}
            {/* We avoid animating CSS `transform` because it fights framer-motion's `y` + `scale` */}
            <Dialog.Popup
              data-slot="dialog-popup"
              className={clsx(styles.popup, className)}
              render={
                <motion.div
                  initial={{ opacity: 0, y: 12, scale: 0.97 }}
                  animate={{
                    opacity: 1,
                    y: 0,
                    scale: 1,
                    transition: { duration: 0.2, ease: [0.16, 1, 0.3, 1] },
                  }}
                  exit={{
                    opacity: 0,
                    y: 8,
                    scale: 0.98,
                    transition: { duration: 0.12 },
                  }}
                />
              }
            >
              {title && (
                <div data-slot="dialog-header" className={styles.header}>
                  <Dialog.Title data-slot="dialog-title" className={styles.title}>
                    {title}
                  </Dialog.Title>
                  <Dialog.Close
                    data-slot="dialog-close"
                    className={styles.close}
                    aria-label={_(msg`Close dialog`)}
                  >
                    <IconX size={18} />
                  </Dialog.Close>
                </div>
              )}

              {description && (
                <Dialog.Description data-slot="dialog-description" className={styles.description}>
                  {description}
                </Dialog.Description>
              )}

              <div data-slot="dialog-content" className={styles.content}>
                {children}
              </div>
            </Dialog.Popup>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  );
}

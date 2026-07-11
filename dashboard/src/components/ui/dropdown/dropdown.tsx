/**
 * Dropdown — a positioned popover for menus, tooltips, and floating content.
 *
 * Built on @base-ui/react/popover. Replaces the previous custom Floating UI
 * implementation. Uses base-ui's built-in positioning (Positioner) for
 * reliable placement, collision detection, and stacking context.
 */
import { createContext, useContext, useState, useCallback, useMemo, type ReactNode } from "react";
import { Popover } from "@base-ui/react/popover";
import { clsx } from "clsx";
import { AnimatePresence, motion } from "framer-motion";

import { MenuCloseContext } from "@/components/ui/menu-item";

import styles from "./dropdown.module.scss";

// ── Context ────────────────────────────────────────────────────────────────────

type DropdownContextType = {
  open: boolean;
  close: () => void;
  dropdownId: string;
};

const DropdownContext = createContext<DropdownContextType | null>(null);

export function useDropdownContext(): DropdownContextType | null {
  return useContext(DropdownContext);
}

// ── Props ──────────────────────────────────────────────────────────────────────

type DropdownProps = {
  children: ReactNode;
  trigger: ReactNode;
  side?: "top" | "bottom" | "left" | "right";
  align?: "start" | "center" | "end";
  sideOffset?: number;
  matchWidth?: boolean;
  className?: string;
};

// ── Component ──────────────────────────────────────────────────────────────────

let dropdownCounter = 0;

export function Dropdown({
  children,
  trigger,
  side = "bottom",
  align = "start",
  sideOffset = 4,
  matchWidth = false,
  className,
}: DropdownProps) {
  const [open, setOpen] = useState(false);

  const close = useCallback(() => setOpen(false), []);

  const id = useMemo(() => `dropdown-${++dropdownCounter}`, []);

  const ctxValue = useMemo<DropdownContextType>(
    () => ({ open, close, dropdownId: id }),
    [open, close, id],
  );

  return (
    <DropdownContext.Provider value={ctxValue}>
      <Popover.Root open={open} onOpenChange={setOpen}>
        <Popover.Trigger
          data-slot="dropdown-trigger"
          data-dropdown-id={id}
          className={styles.triggerWrapper}
          render={<span />}
        >
          {trigger}
        </Popover.Trigger>

        <AnimatePresence>
          {open && (
            <Popover.Portal>
              <Popover.Positioner
                side={side}
                align={align}
                sideOffset={sideOffset}
                className={styles.positioner}
              >
                <Popover.Popup
                  data-slot="dropdown-popup"
                  data-dropdown-id={id}
                  className={clsx(styles.popup, matchWidth && styles.matchWidth, className)}
                  render={
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ duration: 0.12 }}
                    />
                  }
                >
                  <MenuCloseContext.Provider value={close}>{children}</MenuCloseContext.Provider>
                </Popover.Popup>
              </Popover.Positioner>
            </Popover.Portal>
          )}
        </AnimatePresence>
      </Popover.Root>
    </DropdownContext.Provider>
  );
}

import { Tooltip } from "@base-ui/react/tooltip";
import { clsx } from "clsx";
import type { ReactNode } from "react";

import styles from "./tooltip.module.scss";

type TooltipComponentProps = {
  content: ReactNode;
  children: ReactNode;
  side?: "top" | "right" | "bottom" | "left";
  className?: string;
};

export function TooltipComponent({
  content,
  children,
  side = "top",
  className,
}: TooltipComponentProps) {
  return (
    <Tooltip.Root>
      <Tooltip.Trigger data-slot="tooltip-trigger" className={styles.trigger}>
        {children}
      </Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Positioner data-slot="tooltip-positioner" side={side} sideOffset={6}>
          <Tooltip.Popup data-slot="tooltip-popup" className={clsx(styles.popup, className)}>
            {content}
            <Tooltip.Arrow data-slot="tooltip-arrow" className={styles.arrow} />
          </Tooltip.Popup>
        </Tooltip.Positioner>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}

TooltipComponent.displayName = "Tooltip";

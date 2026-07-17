import { type ReactNode, useState } from "react";
import {
  useFloating,
  useHover,
  useInteractions,
  offset,
  flip,
  shift,
  type Placement,
} from "@floating-ui/react";
import { clsx } from "clsx";

import styles from "./timeline-tooltip.module.scss";

// ── Types ──────────────────────────────────────────────────────────────────────

export type TimelineTooltipProps = {
  /** Tooltip content (plain string recommended for timeline blocks). */
  label: ReactNode;
  /** The trigger element. */
  children: ReactNode;
  /** Preferred placement relative to the trigger. */
  placement?: Placement;
  /** Additional class for the floating tooltip element. */
  className?: string;
};

// ── Component ──────────────────────────────────────────────────────────────────

/**
 * Instant hover tooltip for timeline blocks.
 *
 * Renders tooltip in a portal via @floating-ui/react to avoid clipping and
 * z-index issues inherent in CSS-positioned tooltips.
 *
 * Uses {@link useHover} with zero delay for immediate feedback when scanning
 * timeline blocks.
 *
 * @example
 * ```tsx
 * <TimelineTooltip label="Check In: 07:42 - 12:00">
 *   <div className={styles.block} />
 * </TimelineTooltip>
 * ```
 */
export function TimelineTooltip({
  label,
  children,
  placement = "top",
  className,
}: TimelineTooltipProps) {
  const [isOpen, setIsOpen] = useState(false);

  const { refs, floatingStyles, context } = useFloating({
    placement,
    open: isOpen,
    onOpenChange: setIsOpen,
    middleware: [
      offset(4),
      flip(),
      shift({ padding: 8 }),
    ],
  });

  const hover = useHover(context, { delay: 0, restMs: 0 });
  const { getReferenceProps, getFloatingProps } = useInteractions([hover]);

  return (
    <>
      <span
        ref={refs.setReference}
        {...getReferenceProps()}
        style={{ display: "contents" }}
      >
        {children}
      </span>
      {isOpen && label && (
        <div
          ref={refs.setFloating}
          style={floatingStyles}
          {...getFloatingProps()}
          data-slot="timeline-tooltip-floating"
          className={clsx(styles.tooltip, className)}
        >
          {label}
        </div>
      )}
    </>
  );
}

TimelineTooltip.displayName = "TimelineTooltip";

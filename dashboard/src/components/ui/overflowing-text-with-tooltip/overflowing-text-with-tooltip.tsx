import { type ReactNode, useId, useRef, useState, useCallback } from "react";
import { Tooltip } from "@base-ui/react/tooltip";
import { clsx } from "clsx";

import styles from "./overflowing-text-with-tooltip.module.scss";

export type OverflowingTextWithTooltipProps = {
  /** The text content. When overflowing, a tooltip shows the full text. Not used when noTooltip is true. */
  text?: string;
  /** Rich content for noTooltip mode. Supports ReactNode children. */
  children?: ReactNode;
  /** Optional custom tooltip content (overrides `text` for the tooltip). Only in tooltip mode. */
  tooltipContent?: string;
  /**
   * When true, behaves like EllipsisDisplay: pure CSS text truncation without a tooltip.
   * Uses `children` prop for rich content support. Defaults to false.
   */
  noTooltip?: boolean;
  /** Maximum width in pixels for the noTooltip mode. */
  maxWidth?: number;
  /**
   * Maximum number of visible lines before truncation.
   * When set, uses multi-line clamping. When omitted, uses single-line ellipsis.
   */
  displayedMaxRows?: number;
  className?: string;
};

/**
 * 1:1 port of Reaktly's OverflowingTextWithTooltip.
 *
 * Renders text with overflow truncation. On hover, detects whether the
 * text overflows its container and conditionally shows a tooltip with
 * the full content.
 *
 * Supports both single-line (ellipsis) and multi-line (line-clamp) modes.
 */
export function OverflowingTextWithTooltip({
  text,
  children,
  tooltipContent,
  noTooltip = false,
  maxWidth,
  displayedMaxRows,
  className,
}: OverflowingTextWithTooltipProps) {
  const id = useId();
  const textRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [isOverflowing, setIsOverflowing] = useState(false);

  const tooltipText = tooltipContent ?? text ?? "";

  const handleMouseEnter = useCallback(() => {
    const el = textRef.current;
    if (!el) return;

    const overflowing = el.scrollHeight > el.clientHeight || el.scrollWidth > el.clientWidth;

    setIsOverflowing(overflowing);
    setOpen(overflowing);
  }, []);

  const handleMouseLeave = useCallback(() => {
    setOpen(false);
  }, []);

  const isMultiLine = displayedMaxRows !== undefined;

  // ── noTooltip mode: pure CSS ellipsis (EllipsisDisplay behavior) ──
  if (noTooltip) {
    return (
      <div
        data-slot="overflowing-text"
        className={clsx(
          isMultiLine ? styles.overflowingMultilineText : styles.overflowingText,
          className,
        )}
        style={{
          ...(isMultiLine
            ? ({ "--displayed-max-rows": displayedMaxRows } as React.CSSProperties)
            : undefined),
          ...(maxWidth ? { maxWidth: `${maxWidth}px` } : undefined),
        }}
      >
        {children ?? text}
      </div>
    );
  }

  // ── Tooltip mode ──
  return (
    <Tooltip.Root open={open} onOpenChange={setOpen}>
      <Tooltip.Trigger
        id={id}
        className={styles.trigger}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        <div
          ref={textRef}
          data-slot="overflowing-text"
          data-overflowing={isOverflowing ? "" : undefined}
          className={clsx(
            isMultiLine ? styles.overflowingMultilineText : styles.overflowingText,
            className,
          )}
          style={
            isMultiLine
              ? ({ "--displayed-max-rows": displayedMaxRows } as React.CSSProperties)
              : undefined
          }
        >
          {text}
        </div>
      </Tooltip.Trigger>

      <Tooltip.Portal>
        <Tooltip.Positioner side="bottom" sideOffset={5}>
          <Tooltip.Popup data-slot="overflowing-text-tooltip" className={styles.tooltip}>
            {tooltipText}
          </Tooltip.Popup>
        </Tooltip.Positioner>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}

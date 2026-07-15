import { clsx } from "clsx";

import { OverflowingTextWithTooltip } from "@/components/ui/overflowing-text-with-tooltip";

import styles from "./display.module.scss";

type TextDisplayProps = {
  text: string;
  displayedMaxRows?: number;
  className?: string;
};

/**
 * Read-only text display with truncation and tooltip.
 *
 * Single-line by default. Set `displayedMaxRows` > 1 for
 * multi-line display (e.g., description fields).
 */
export function TextDisplay({
  text,
  displayedMaxRows,
  className,
}: TextDisplayProps) {
  const isSingleLine =
    displayedMaxRows === undefined || displayedMaxRows === 1;

  return (
    <span
      data-slot="text-display"
      className={clsx(
        styles.displayContainer,
        isSingleLine && styles.fixedHeight,
        className,
      )}
    >
      <OverflowingTextWithTooltip
        text={text}
        displayedMaxRows={displayedMaxRows}
      />
    </span>
  );
}

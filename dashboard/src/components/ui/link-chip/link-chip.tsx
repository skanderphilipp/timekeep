import { type ReactNode, type MouseEvent, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { clsx } from "clsx";

import { OverflowingTextWithTooltip } from "@/components/ui/overflowing-text-with-tooltip";

import styles from "./link-chip.module.scss";

// ── Types ──────────────────────────────────────────────────────────────────────

export type TriggerEventType = "MOUSE_DOWN" | "CLICK";

export type LinkChipProps = {
  to: string;
  label: string;
  /** When true, hides the label text (only icons/components visible). */
  isLabelHidden?: boolean;
  /** Use medium font weight. */
  isBold?: boolean;
  /** Optional content rendered before the label. */
  leftComponent?: ReactNode | null;
  /** Optional content rendered after the label. */
  rightComponent?: ReactNode | null;
  /** Show a divider before the right component. */
  rightComponentDivider?: boolean;
  /** Max width before text truncation kicks in. */
  maxWidth?: number;
  className?: string;
  onClick?: (event: MouseEvent<HTMLElement>) => void;
  onMouseDown?: (event: MouseEvent<HTMLElement>) => void;
  triggerEvent?: TriggerEventType;
  target?: "_blank" | "_self";
  /** Fallback text when label is empty. Defaults to "Untitled" (i18n). */
  emptyLabel?: string;
};

// ── Helpers ────────────────────────────────────────────────────────────────────

const LINK_CHIP_CLICK_OUTSIDE_ID = "link-chip-click-outside-id";

function isNavigationModifierPressed(
  event: Pick<MouseEvent, "button" | "metaKey" | "altKey" | "ctrlKey" | "shiftKey">,
): boolean {
  const modifier = [event.altKey, event.ctrlKey, event.shiftKey, event.metaKey].some(Boolean);
  const isLeftClick = event.button === 0;
  return modifier || !isLeftClick;
}

/** Render the right component, optionally preceded by a divider. */
function renderRightComponent(
  rightComponent: ReactNode | null,
  rightComponentDivider?: boolean,
): ReactNode {
  if (!rightComponent) return null;
  if (rightComponentDivider) {
    return (
      <>
        <span className={styles.rightComponentDivider} />
        {rightComponent}
      </>
    );
  }
  return rightComponent;
}

// ── Component ──────────────────────────────────────────────────────────────────

/**
 * Navigation chip — a clickable label that acts as an internal link.
 *
 * Used in data tables and detail views for entity navigation (device serial
 * numbers, user PINs). Renders as a compact chip with optional icons and
 * text overflow truncation.
 *
 * Formerly wrapped `<Chip>`; now self-contained with its own rendering.
 */
export const LinkChip = ({
  to,
  label,
  isLabelHidden = false,
  isBold = false,
  leftComponent = null,
  rightComponent = null,
  rightComponentDivider = false,
  className,
  maxWidth,
  onClick,
  triggerEvent = "MOUSE_DOWN",
  target,
  emptyLabel = "Untitled",
}: LinkChipProps) => {
  const navigate = useNavigate();

  const handleClick = useCallback(
    (event: MouseEvent<HTMLElement>) => {
      event.stopPropagation();
      if (isNavigationModifierPressed(event)) {
        onClick?.(event);
        return;
      }
      event.preventDefault();
      onClick?.(event);
      if (!onClick) navigate(to);
    },
    [to, navigate, onClick],
  );

  const handleMouseDown = useCallback(
    (event: MouseEvent<HTMLElement>) => {
      if (triggerEvent === "CLICK") return;
      if (isNavigationModifierPressed(event)) return;
      onClick?.(event);
      if (!onClick) navigate(to);
    },
    [to, navigate, onClick, triggerEvent],
  );

  const chipClasses = clsx(
    styles.chip,
    isBold && styles.bold,
    maxWidth != null && styles.hasMaxWidth,
    className,
  );

  const chipStyle = maxWidth
    ? ({ "--chip-max-width": `${maxWidth}px` } as React.CSSProperties)
    : undefined;

  const labelContent =
    !isLabelHidden && label ? (
      <OverflowingTextWithTooltip text={label} displayedMaxRows={1} />
    ) : !isLabelHidden ? (
      <span className={styles.emptyLabel}>{emptyLabel}</span>
    ) : null;

  return (
    <span className={styles.linkContainer}>
      <Link
        to={to}
        onClick={handleClick}
        onMouseDown={handleMouseDown}
        data-click-outside-id={LINK_CHIP_CLICK_OUTSIDE_ID}
        target={target}
        rel={target === "_blank" ? "noopener noreferrer" : undefined}
        className={chipClasses}
        style={chipStyle}
      >
        {leftComponent}
        {labelContent}
        {renderRightComponent(rightComponent, rightComponentDivider)}
      </Link>
    </span>
  );
};

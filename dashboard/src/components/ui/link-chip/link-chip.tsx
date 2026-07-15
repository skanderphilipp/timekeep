import { type MouseEvent, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { clsx } from "clsx";

import { OverflowingTextWithTooltip } from "@/components/ui/overflowing-text-with-tooltip";
import tagStyles from "@/components/ui/tag/tag.module.scss";

import styles from "./link-chip.module.scss";

export type TriggerEventType = "MOUSE_DOWN" | "CLICK";

export type LinkChipProps = {
  to: string;
  label: string;
  isLabelHidden?: boolean;
  isBold?: boolean;
  leftComponent?: React.ReactNode | null;
  rightComponent?: React.ReactNode | null;
  rightComponentDivider?: boolean;
  maxWidth?: number;
  className?: string;
  onClick?: (event: MouseEvent<HTMLElement>) => void;
  onMouseDown?: (event: MouseEvent<HTMLElement>) => void;
  triggerEvent?: TriggerEventType;
  target?: "_blank" | "_self";
  emptyLabel?: string;
};

const LINK_CHIP_CLICK_OUTSIDE_ID = "link-chip-click-outside-id";

function isNavigationModifierPressed(
  event: Pick<MouseEvent, "button" | "metaKey" | "altKey" | "ctrlKey" | "shiftKey">,
): boolean {
  const modifier = [event.altKey, event.ctrlKey, event.shiftKey, event.metaKey].some(Boolean);
  const isLeftClick = event.button === 0;
  return modifier || !isLeftClick;
}

function renderRightComponent(
  rightComponent: React.ReactNode | null,
  rightComponentDivider?: boolean,
): React.ReactNode {
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
        className={clsx(
          tagStyles.tag,
          tagStyles.label,
          isBold && styles.bold,
          maxWidth != null && styles.hasMaxWidth,
          className,
        )}
        data-slot="tag"
        data-color="accent"
        data-variant="outline"
        data-interactive
        style={chipStyle}
      >
        {leftComponent}
        {labelContent}
        {renderRightComponent(rightComponent, rightComponentDivider)}
      </Link>
    </span>
  );
};

LinkChip.displayName = "LinkChip";

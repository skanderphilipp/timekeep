import { type MouseEvent, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";

import {
  Chip,
  ChipAccent,
  type ChipProps,
  ChipSize,
  ChipVariant,
} from "@/components/ui/chip";

import styles from "./link-chip.module.scss";

// ── Types ──────────────────────────────────────────────────────────────────────

export type TriggerEventType = "MOUSE_DOWN" | "CLICK";

export type LinkChipProps = Omit<
  ChipProps,
  "onClick" | "disabled" | "clickable"
> & {
  to: string;
  onClick?: (event: MouseEvent<HTMLElement>) => void;
  onMouseDown?: (event: MouseEvent<HTMLElement>) => void;
  triggerEvent?: TriggerEventType;
  target?: "_blank" | "_self";
};

// ── Helpers ────────────────────────────────────────────────────────────────────

const LINK_CHIP_CLICK_OUTSIDE_ID = "link-chip-click-outside-id";

function isNavigationModifierPressed(
  event: Pick<MouseEvent, "button" | "metaKey" | "altKey" | "ctrlKey" | "shiftKey">,
): boolean {
  const modifier = [event.altKey, event.ctrlKey, event.shiftKey, event.metaKey].some(
    Boolean,
  );
  const isLeftClick = event.button === 0;
  return modifier || !isLeftClick;
}

// ── Component ──────────────────────────────────────────────────────────────────

export const LinkChip = ({
  to,
  size = ChipSize.Small,
  label,
  isLabelHidden = false,
  isBold = false,
  variant = ChipVariant.Regular,
  leftComponent = null,
  rightComponent = null,
  rightComponentDivider = false,
  accent = ChipAccent.TextPrimary,
  className,
  maxWidth,
  onClick,
  triggerEvent = "MOUSE_DOWN",
  target,
  emptyLabel,
}: LinkChipProps) => {
  const navigate = useNavigate();

  // Regular click handler — used when triggerEvent is "CLICK"
  const handleClick = useCallback(
    (event: MouseEvent<HTMLElement>) => {
      event.stopPropagation();

      if (isNavigationModifierPressed(event)) {
        // Let the browser handle modifier-clicks naturally (new tab, etc.)
        onClick?.(event);
        return;
      }

      event.preventDefault();
      onClick?.(event);
      if (!onClick) navigate(to);
    },
    [to, navigate, onClick],
  );

  // Mouse-down handler — used by default ("MOUSE_DOWN") for faster response
  const handleMouseDown = useCallback(
    (event: MouseEvent<HTMLElement>) => {
      if (triggerEvent === "CLICK") return;
      if (isNavigationModifierPressed(event)) return;

      onClick?.(event);
      if (!onClick) navigate(to);
    },
    [to, navigate, onClick, triggerEvent],
  );

  return (
    <span className={styles.linkContainer}>
      <Link
        to={to}
        onClick={handleClick}
        onMouseDown={handleMouseDown}
        data-click-outside-id={LINK_CHIP_CLICK_OUTSIDE_ID}
        target={target}
        rel={target === "_blank" ? "noopener noreferrer" : undefined}
      >
        <Chip
          size={size}
          label={label}
          isLabelHidden={isLabelHidden}
          isBold={isBold}
          clickable={true}
          variant={variant}
          leftComponent={leftComponent}
          rightComponent={rightComponent}
          rightComponentDivider={rightComponentDivider}
          accent={accent}
          className={className}
          maxWidth={maxWidth}
          emptyLabel={emptyLabel}
        />
      </Link>
    </span>
  );
};

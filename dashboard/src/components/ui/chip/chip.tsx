import { type ReactNode, type MouseEvent } from "react";
import { useLingui } from "@lingui/react";
import { msg } from "@lingui/core/macro";

import { OverflowingTextWithTooltip } from "@/components/ui/overflowing-text-with-tooltip";
import { isDefined, isNonEmptyString } from "@/lib/type-guards";
import { clsx } from "clsx";

import styles from "./chip.module.scss";

export enum ChipSize {
  Large = "large",
  Small = "small",
}

export enum ChipAccent {
  TextPrimary = "text-primary",
  TextSecondary = "text-secondary",
}

export enum ChipVariant {
  Highlighted = "highlighted",
  Regular = "regular",
  Transparent = "transparent",
  Rounded = "rounded",
  Static = "static",
}

export type ChipProps = {
  size?: ChipSize;
  disabled?: boolean;
  clickable?: boolean;
  label: string;
  tooltipLabel?: string;
  isLabelHidden?: boolean;
  isBold?: boolean;
  maxWidth?: number;
  variant?: ChipVariant;
  accent?: ChipAccent;
  leftComponent?: ReactNode | null;
  rightComponent?: (() => ReactNode) | ReactNode | null;
  rightComponentDivider?: boolean;
  className?: string;
  forceEmptyText?: boolean;
  emptyLabel?: string;
  onClick?: (event: MouseEvent<HTMLDivElement>) => void;
};

const renderRightComponent = (
  rightComponent: (() => ReactNode) | ReactNode | null,
  rightComponentDivider?: boolean,
) => {
  if (!rightComponent) {
    return null;
  }

  const rendered = typeof rightComponent === "function" ? rightComponent() : rightComponent;

  if (rightComponentDivider === true) {
    return (
      <>
        <div className={styles.rightComponentDivider} />
        {rendered}
      </>
    );
  }

  return rendered;
};

export const Chip = ({
  size = ChipSize.Small,
  label,
  tooltipLabel,
  isLabelHidden = false,
  isBold = false,
  disabled = false,
  clickable = true,
  variant = ChipVariant.Regular,
  leftComponent = null,
  rightComponent = null,
  rightComponentDivider = false,
  accent = ChipAccent.TextPrimary,
  className,
  maxWidth,
  forceEmptyText = false,
  emptyLabel,
  onClick,
}: ChipProps) => {
  const { _ } = useLingui();
  const resolvedEmptyLabel = emptyLabel ?? _(msg`Untitled`);
  // Cursor precedence mirrors the Linaria ternary:
  // transparent > clickable > disabled > inherit.
  const cursorClass =
    variant === ChipVariant.Transparent
      ? undefined
      : clickable
        ? styles.cursorPointer
        : disabled
          ? styles.cursorNotAllowed
          : undefined;

  const backgroundClass =
    variant === ChipVariant.Highlighted
      ? styles.backgroundHighlighted
      : variant === ChipVariant.Static
        ? styles.backgroundStatic
        : variant === ChipVariant.Regular && !disabled && clickable
          ? styles.interactiveRegular
          : undefined;

  return (
    <div
      data-testid="chip"
      onClick={onClick}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClick(e as unknown as MouseEvent<HTMLDivElement>);
              }
            }
          : undefined
      }
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      className={clsx(
        styles.chip,
        size === ChipSize.Large ? styles.sizeLarge : styles.sizeSmall,
        accent === ChipAccent.TextPrimary ? styles.accentTextPrimary : styles.accentTextSecondary,
        disabled && styles.disabled,
        (isBold || accent === ChipAccent.TextSecondary) && styles.fontMedium,
        cursorClass,
        backgroundClass,
        maxWidth ? styles.hasMaxWidth : undefined,
        variant === ChipVariant.Transparent && styles.paddingLeftNone,
        className,
      )}
      style={
        maxWidth ? ({ "--chip-max-width": `${maxWidth}px` } as React.CSSProperties) : undefined
      }
    >
      {leftComponent}
      {!isLabelHidden && isDefined(label) && isNonEmptyString(label) ? (
        <OverflowingTextWithTooltip
          text={label}
          tooltipContent={tooltipLabel}
          displayedMaxRows={1}
        />
      ) : !forceEmptyText && !isLabelHidden ? (
        <div className={styles.emptyLabel}>{resolvedEmptyLabel}</div>
      ) : (
        ""
      )}
      {renderRightComponent(rightComponent, rightComponentDivider)}
    </div>
  );
};

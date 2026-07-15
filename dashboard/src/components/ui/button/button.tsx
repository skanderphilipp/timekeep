import { clsx } from "clsx";
import { type ButtonHTMLAttributes, type ReactNode } from "react";
import { Link, type LinkProps } from "react-router-dom";

import styles from "./button.module.scss";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
type ButtonSize = "sm" | "md";

type ButtonBaseProps = {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  icon?: ReactNode;
  fullWidth?: boolean;
  className?: string;
  children: ReactNode;
};

type ButtonAsButton = ButtonBaseProps &
  Omit<ButtonHTMLAttributes<HTMLButtonElement>, keyof ButtonBaseProps> & {
    to?: never;
  };

type ButtonAsLink = ButtonBaseProps &
  Omit<LinkProps, keyof ButtonBaseProps> & {
    to: string;
  };

export type ButtonProps = ButtonAsButton | ButtonAsLink;

export function Button(props: ButtonProps) {
  const {
    variant = "primary",
    size = "md",
    loading = false,
    icon,
    fullWidth = false,
    children,
    className,
  } = props;

  const to = "to" in props ? (props as ButtonAsLink).to : undefined;
  const disabled = !to ? (props as ButtonAsButton).disabled : undefined;
  const isDisabled = loading || !!disabled;

  const classNames = clsx(styles.button, className);

  const content = (
    <>
      {loading && <span data-slot="button-spinner" className={styles.spinner} aria-hidden="true" />}
      {!loading && icon && (
        <span data-slot="button-icon" className={styles.icon}>
          {icon}
        </span>
      )}
      <span data-slot="button-label">{children}</span>
    </>
  );

  if (to) {
    const {
      variant: _v,
      size: _s,
      loading: _l,
      icon: _i,
      fullWidth: _f,
      to: _t,
      className: _c,
      ...linkProps
    } = props as ButtonAsLink;
    return (
      <Link
        data-slot="button"
        data-variant={variant}
        data-size={size}
        data-full-width={fullWidth || undefined}
        className={classNames}
        aria-disabled={isDisabled || undefined}
        tabIndex={isDisabled ? -1 : undefined}
        onClick={isDisabled ? (e) => e.preventDefault() : undefined}
        {...linkProps}
        to={to}
      >
        {content}
      </Link>
    );
  }

  const {
    variant: _v,
    size: _s,
    loading: _l,
    icon: _i,
    fullWidth: _f,
    to: _t,
    className: _c,
    disabled: _d,
    ...buttonProps
  } = props as ButtonAsButton;
  return (
    <button
      data-slot="button"
      data-variant={variant}
      data-size={size}
      data-full-width={fullWidth || undefined}
      data-disabled={isDisabled || undefined}
      data-loading={loading || undefined}
      disabled={isDisabled}
      className={classNames}
      {...buttonProps}
    >
      {content}
    </button>
  );
}

Button.displayName = "Button";

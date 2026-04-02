import { clsx } from "clsx";
import { msg } from "@lingui/core/macro";
import { useLingui } from "@lingui/react";

import styles from "./spinner.module.scss";

type SpinnerProps = {
  size?: "sm" | "md" | "lg";
  className?: string;
};

export function Spinner({ size = "md", className }: SpinnerProps) {
  const { _ } = useLingui();

  return (
    <span
      data-slot="spinner"
      role="status"
      aria-label={_(msg`Loading`)}
      className={clsx(styles.spinner, styles[size], className)}
    />
  );
}

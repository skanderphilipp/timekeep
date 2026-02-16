import { clsx } from "clsx";
import { type ReactNode, useMemo } from "react";
import { motion, type HTMLMotionProps } from "framer-motion";
import { useLingui } from "@lingui/react";
import { msg } from "@lingui/core/macro";

import { Button } from "../button";

import styles from "./animated-button.module.scss";

/**
 * Extended button with motion animation.
 *
 * Wraps our base Button with framer-motion for smooth hover/active
 * transitions. Supports an animated SVG that plays on hover, plus a
 * "soon" badge for features that aren't ready yet.
 */
export type AnimatedButtonProps = {
  /** Animated SVG or motion component rendered alongside the label. */
  animatedSvg?: ReactNode;
  /** Shows a "Soon" pill when true — disables the button. */
  soon?: boolean;
  /** Custom label for the "Soon" badge. Defaults to "Soon". */
  soonLabel?: string;
  /** The button label / children. */
  children: ReactNode;
  /** Disables the button. */
  disabled?: boolean;
  /** Shows a loading spinner. */
  loading?: boolean;
  /** Click handler. */
  onClick?: () => void;
  /** Button variant (passed to inner Button). */
  variant?: "primary" | "secondary" | "ghost" | "danger";
  /** Button size. */
  size?: "sm" | "md";
  className?: string;
};

const hoverScale = { scale: 1.02 };
const tapScale = { scale: 0.97 };
const transition = { type: "spring", stiffness: 400, damping: 25 } as const;

export function AnimatedButton({
  animatedSvg,
  soon = false,
  soonLabel,
  children,
  disabled = false,
  loading = false,
  onClick,
  variant = "primary",
  size = "md",
  className,
}: AnimatedButtonProps) {
  const { _ } = useLingui();
  const resolvedSoonLabel = soonLabel ?? _(msg`Soon`);
  const isDisabled = soon || disabled;

  const motionProps: HTMLMotionProps<"div"> = useMemo(
    () => ({
      whileHover: isDisabled ? undefined : hoverScale,
      whileTap: isDisabled ? undefined : tapScale,
      transition,
    }),
    [isDisabled],
  );

  return (
    <motion.div
      className={clsx(styles.wrapper, className)}
      {...motionProps}
    >
      <Button
        variant={variant}
        size={size}
        disabled={isDisabled}
        loading={loading}
        onClick={onClick}
        className={styles.button}
      >
        {animatedSvg && !loading && (
          <span className={styles.animatedSvg} aria-hidden="true">
            {animatedSvg}
          </span>
        )}
        {children}
      </Button>

      {soon && (
        <span className={styles.soonBadge} aria-hidden="true">
          {resolvedSoonLabel}
        </span>
      )}
    </motion.div>
  );
}

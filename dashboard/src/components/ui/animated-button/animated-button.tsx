import { clsx } from "clsx";
import { type ReactNode, useMemo } from "react";
import { motion, type HTMLMotionProps } from "framer-motion";

import { Button } from "../button";

import styles from "./animated-button.module.scss";

/**
 * Button with framer-motion hover/active scale transitions.
 *
 * Thin wrapper around our base Button — adds spring-animated
 * hover (1.02×) and tap (0.97×) transforms.
 *
 * For feature-flag "Coming Soon" badges, compose externally:
 * wrap this component with a relative container + badge overlay.
 */
export type AnimatedButtonProps = {
  /** Animated SVG or motion component rendered alongside the label. */
  animatedSvg?: ReactNode;
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
  children,
  disabled = false,
  loading = false,
  onClick,
  variant = "primary",
  size = "md",
  className,
}: AnimatedButtonProps) {
  const motionProps: HTMLMotionProps<"div"> = useMemo(
    () => ({
      whileHover: disabled ? undefined : hoverScale,
      whileTap: disabled ? undefined : tapScale,
      transition,
    }),
    [disabled],
  );

  return (
    <motion.div className={clsx(styles.wrapper, className)} {...motionProps}>
      <Button
        variant={variant}
        size={size}
        disabled={disabled}
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
    </motion.div>
  );
}

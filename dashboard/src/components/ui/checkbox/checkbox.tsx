import { clsx } from "clsx";
import { forwardRef } from "react";
import { Checkbox as CheckboxPrimitive } from "@base-ui/react/checkbox";
import { IconCheck, IconMinus } from "@tabler/icons-react";

import styles from "./checkbox.module.scss";

type CheckboxProps = {
  checked?: boolean;
  defaultChecked?: boolean;
  disabled?: boolean;
  indeterminate?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  label?: string;
  className?: string;
  id?: string;
  "aria-label"?: string;
};

export const Checkbox = forwardRef<HTMLButtonElement, CheckboxProps>(
  (
    {
      checked,
      defaultChecked,
      disabled,
      indeterminate,
      onCheckedChange,
      label,
      className,
      id,
      "aria-label": ariaLabel,
    },
    externalRef,
  ) => {
    return (
      <CheckboxPrimitive.Root
        ref={externalRef}
        checked={checked}
        defaultChecked={defaultChecked}
        disabled={disabled}
        indeterminate={indeterminate}
        onCheckedChange={onCheckedChange}
        id={id}
        aria-label={ariaLabel}
        data-slot="checkbox"
        className={clsx(styles.root, className)}
      >
        <span data-slot="checkbox-box" className={styles.box}>
          <CheckboxPrimitive.Indicator className={styles.indicator}>
            {indeterminate ? <IconMinus aria-hidden /> : <IconCheck aria-hidden />}
          </CheckboxPrimitive.Indicator>
        </span>
        {label && (
          <span data-slot="checkbox-label" className={styles.labelText}>
            {label}
          </span>
        )}
      </CheckboxPrimitive.Root>
    );
  },
);

Checkbox.displayName = "Checkbox";

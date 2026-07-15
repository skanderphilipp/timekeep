import { clsx } from "clsx";
import { forwardRef } from "react";
import { Switch as BaseUISwitch } from "@base-ui/react/switch";

import styles from "./switch.module.scss";

type SwitchProps = {
  label?: string;
  className?: string;
  checked?: boolean;
  defaultChecked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  disabled?: boolean;
  name?: string;
  value?: string;
  required?: boolean;
  readOnly?: boolean;
  id?: string;
};

export const Switch = forwardRef<HTMLInputElement, SwitchProps>(
  (
    {
      label,
      className,
      disabled,
      checked,
      defaultChecked,
      onCheckedChange,
      name,
      value,
      required,
      readOnly,
      id,
    },
    ref,
  ) => {
    const switchElement = (
      <BaseUISwitch.Root
        inputRef={ref}
        data-slot="switch"
        className={clsx(styles.root, className)}
        checked={checked}
        defaultChecked={defaultChecked}
        onCheckedChange={onCheckedChange}
        disabled={disabled}
        name={name}
        value={value}
        required={required}
        readOnly={readOnly}
        id={id}
      >
        <BaseUISwitch.Thumb data-slot="switch-thumb" className={styles.thumb} />
      </BaseUISwitch.Root>
    );

    if (!label) return switchElement;

    return (
      <label className={clsx(styles.label, disabled && styles.disabled)}>
        {switchElement}
        <span data-slot="switch-label" className={styles.labelText}>
          {label}
        </span>
      </label>
    );
  },
);

Switch.displayName = "Switch";

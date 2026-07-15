import { useMemo, useId } from "react";
import { clsx } from "clsx";
import { msg } from "@lingui/core/macro";
import { useLingui } from "@lingui/react";

import { MultiSelect, type MultiSelectOption } from "@/components/ui/multi-select";
import { ALL_PERMISSIONS, parsePermissionsString } from "@/lib/permissions";
import styles from "./permission-multiselect.module.scss";

type PermissionMultiSelectProps = {
  /** Accessible label rendered above the control. */
  label?: string;
  /** Validation error message. */
  error?: string;
  /** Helper text shown when no error. */
  helperText?: string;
  /** Mark as required (shows asterisk). */
  required?: boolean;
  values: string[] | string;
  onChange: (permissions: string[]) => void;
  placeholder?: string;
  fullWidth?: boolean;
  /** Disable the control. */
  disabled?: boolean;
  className?: string;
  /** HTML id (auto-generated if omitted). */
  id?: string;
};

export function PermissionMultiSelect({
  label,
  error,
  helperText,
  required = false,
  values,
  onChange,
  placeholder,
  fullWidth = false,
  disabled = false,
  className,
  id: externalId,
}: PermissionMultiSelectProps) {
  const { _ } = useLingui();
  const autoId = useId();
  const controlId = externalId ?? autoId;

  const normalizedValues = useMemo(() => {
    if (Array.isArray(values)) return values;
    return parsePermissionsString(values);
  }, [values]);

  const options: MultiSelectOption[] = useMemo(
    () => ALL_PERMISSIONS.map((perm) => ({ value: perm.value, label: perm.label })),
    [],
  );

  return (
    <MultiSelect
      id={controlId}
      label={label}
      error={error}
      helperText={helperText}
      required={required}
      options={options}
      values={normalizedValues}
      onChange={onChange}
      placeholder={placeholder ?? _(msg`Select permissions…`)}
      searchPlaceholder={_(msg`Search permissions…`)}
      emptyMessage={_(msg`No permissions found`)}
      disabled={disabled}
      fullWidth={fullWidth}
      className={clsx(styles.container, className)}
    />
  );
}

import { useMemo } from "react";
import { clsx } from "clsx";
import { msg } from "@lingui/core/macro";
import { useLingui } from "@lingui/react";

import { MultiSelect, type MultiSelectOption } from "@/components/ui/multi-select";
import { ALL_PERMISSIONS, parsePermissionsString } from "@/lib/permissions";
import styles from "./permission-multiselect.module.scss";

type PermissionMultiSelectProps = {
  values: string[] | string;
  onChange: (permissions: string[]) => void;
  placeholder?: string;
  fullWidth?: boolean;
  className?: string;
};

export function PermissionMultiSelect({
  values,
  onChange,
  placeholder,
  fullWidth = false,
  className,
}: PermissionMultiSelectProps) {
  const { _ } = useLingui();

  const normalizedValues = useMemo(() => {
    if (Array.isArray(values)) return values;
    return parsePermissionsString(values);
  }, [values]);

  const options: MultiSelectOption[] = useMemo(
    () => ALL_PERMISSIONS.map((perm) => ({ value: perm.value, label: perm.label })),
    [],
  );

  return (
    <div
      data-slot="permission-multiselect"
      className={clsx(styles.container, fullWidth && styles.fullWidth, className)}
    >
      <MultiSelect
        options={options}
        values={normalizedValues}
        onChange={onChange}
        placeholder={placeholder ?? _(msg`Select permissions…`)}
        searchPlaceholder={_(msg`Search permissions…`)}
        emptyMessage={_(msg`No permissions found`)}
      />
    </div>
  );
}

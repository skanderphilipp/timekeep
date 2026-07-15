import { Controller, type UseFormReturn } from "react-hook-form";

import { PermissionMultiSelect } from "@/modules/shared/components/permission-multiselect";
import type { FormPermissionsFieldDef } from "@/components/ui/form/form-field-def";

/**
 * Permissions form field — self-contained PermissionMultiSelect.
 *
 * PermissionMultiSelect passes label/error/helper through to MultiSelect.
 * Twenty-aligned: no FormField wrapper needed.
 */
export function FormFieldPermissions({
  field,
  form,
}: {
  field: FormPermissionsFieldDef;
  form: UseFormReturn<any>;
  inputId?: string;
}) {
  const error = form.formState.errors[field.name]?.message as string | undefined;

  return (
    <Controller
      name={field.name}
      control={form.control}
      render={({ field: controllerField }) => (
        <PermissionMultiSelect
          label={field.label}
          error={error}
          helperText={field.description}
          required={field.required}
          values={(controllerField.value as string[]) ?? []}
          onChange={controllerField.onChange}
          placeholder={field.placeholder}
          disabled={field.disabled}
          fullWidth
        />
      )}
    />
  );
}

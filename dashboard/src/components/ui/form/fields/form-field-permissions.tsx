import { Controller, type UseFormReturn } from "react-hook-form";

import { FormField } from "@/components/ui/form/form-field";
import { FieldInputContainer } from "@/components/ui/form/field-input-container";
import { PermissionMultiSelect } from "@/modules/shared/components/permission-multiselect";
import type { FormPermissionsFieldDef } from "@/components/ui/form/form-field-def";

export function FormFieldPermissions({
  field,
  form,
  inputId,
}: {
  field: FormPermissionsFieldDef;
  form: UseFormReturn<any>;
  inputId: string;
}) {
  const error = form.formState.errors[field.name]?.message as string | undefined;

  return (
    <FormField
      label={field.label}
      required={field.required}
      helperText={field.description}
      error={error}
      htmlFor={inputId}
    >
      <FieldInputContainer>
        <Controller
          name={field.name}
          control={form.control}
          render={({ field: controllerField }) => (
            <PermissionMultiSelect
              values={(controllerField.value as string[]) ?? []}
              onChange={controllerField.onChange}
              placeholder={field.placeholder}
            />
          )}
        />
      </FieldInputContainer>
    </FormField>
  );
}

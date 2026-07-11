import { Controller, type UseFormReturn } from "react-hook-form";

import { FormField } from "@/components/ui/form/form-field";
import { FieldInputContainer } from "@/components/ui/form/field-input-container";
import { ExpiryPicker, type ExpiryValue } from "@/components/ui/expiry-picker";
import type { FormExpiryFieldDef } from "@/components/ui/form/form-field-def";

export function FormFieldExpiry({
  field,
  form,
  inputId,
}: {
  field: FormExpiryFieldDef;
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
            <ExpiryPicker
              value={
                (controllerField.value as ExpiryValue) ?? { preset: "never", customDate: null }
              }
              onChange={controllerField.onChange}
            />
          )}
        />
      </FieldInputContainer>
    </FormField>
  );
}

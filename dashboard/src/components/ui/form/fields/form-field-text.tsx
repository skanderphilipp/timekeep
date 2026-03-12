import { Controller, type UseFormReturn } from "react-hook-form";

import { FormField } from "@/components/ui/form/form-field";
import { FieldInputContainer } from "@/components/ui/form/field-input-container";
import { Input } from "@/components/ui/input";
import type { FormTextFieldDef } from "@/components/ui/form/form-field-def";

export function FormFieldText({
  field,
  form,
  inputId,
}: {
  field: FormTextFieldDef;
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
            <Input
              {...controllerField}
              id={inputId}
              type={field.inputType ?? "text"}
              placeholder={field.placeholder}
              disabled={field.disabled}
              readOnly={field.readonly}
              required={field.required}
              fullWidth
            />
          )}
        />
      </FieldInputContainer>
    </FormField>
  );
}

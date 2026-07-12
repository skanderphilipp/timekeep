import { Controller, type UseFormReturn } from "react-hook-form";

import { FormField } from "@/components/ui/form/form-field";
import { FieldInputContainer } from "@/components/ui/form/field-input-container";
import { Switch } from "@/components/ui/switch";
import type { FormBooleanFieldDef } from "@/components/ui/form/form-field-def";

export function FormFieldBoolean({
  field,
  form,
  inputId,
}: {
  field: FormBooleanFieldDef;
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
            <Switch
              id={inputId}
              checked={controllerField.value === true}
              onCheckedChange={(checked) => controllerField.onChange(checked)}
              label={field.description ?? field.label}
              disabled={field.disabled}
            />
          )}
        />
      </FieldInputContainer>
    </FormField>
  );
}

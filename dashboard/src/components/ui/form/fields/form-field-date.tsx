import { Controller, type UseFormReturn } from "react-hook-form";

import { FormField } from "@/components/ui/form/form-field";
import { FieldInputContainer } from "@/components/ui/form/field-input-container";
import { DatePicker } from "@/components/ui/date-picker";
import type { FormDateFieldDef } from "@/components/ui/form/form-field-def";

export function FormFieldDate({
  field,
  form,
  inputId,
}: {
  field: FormDateFieldDef;
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
            <DatePicker
              value={controllerField.value as Date | null}
              onChange={(date) => controllerField.onChange(date)}
              placeholder={field.placeholder}
              minDate={field.minDate}
              maxDate={field.maxDate}
            />
          )}
        />
      </FieldInputContainer>
    </FormField>
  );
}

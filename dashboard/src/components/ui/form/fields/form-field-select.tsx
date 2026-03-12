import { Controller, type UseFormReturn } from "react-hook-form";

import { FormField } from "@/components/ui/form/form-field";
import { FieldInputContainer } from "@/components/ui/form/field-input-container";
import { Combobox } from "@/components/ui/combobox";
import type { FormSelectFieldDef } from "@/components/ui/form/form-field-def";

export function FormFieldSelect({
  field,
  form,
  inputId,
}: {
  field: FormSelectFieldDef;
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
            <Combobox
              options={field.options}
              value={controllerField.value as string | undefined}
              onChange={controllerField.onChange}
              placeholder={field.placeholder}
              searchable={field.searchable ?? field.options.length > 8}
            />
          )}
        />
      </FieldInputContainer>
    </FormField>
  );
}

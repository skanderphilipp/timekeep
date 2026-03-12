import { Controller, type UseFormReturn } from "react-hook-form";

import { FormField } from "@/components/ui/form/form-field";
import { FieldInputContainer } from "@/components/ui/form/field-input-container";
import { Input } from "@/components/ui/input";
import type { FormNumberFieldDef } from "@/components/ui/form/form-field-def";

export function FormFieldNumber({
  field,
  form,
  inputId,
}: {
  field: FormNumberFieldDef;
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
              type="number"
              min={field.min}
              max={field.max}
              step={field.step}
              placeholder={field.placeholder}
              disabled={field.disabled}
              readOnly={field.readonly}
              required={field.required}
              fullWidth
              onChange={(e) => {
                const val = e.target.value;
                controllerField.onChange(
                  val === "" ? "" : Number(val),
                );
              }}
            />
          )}
        />
      </FieldInputContainer>
    </FormField>
  );
}

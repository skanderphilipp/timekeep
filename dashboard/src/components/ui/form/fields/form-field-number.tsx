import { Controller, type UseFormReturn } from "react-hook-form";

import { Input } from "@/components/ui/input";
import type { FormNumberFieldDef } from "@/components/ui/form/form-field-def";

/**
 * Number form field — self-contained Input, no FormField wrapper.
 *
 * Handles its own label, error, helperText, min/max/step constraints,
 * and empty-string-to-number conversion for react-hook-form.
 */
export function FormFieldNumber({
  field,
  form,
  inputId,
}: {
  field: FormNumberFieldDef;
  form: UseFormReturn<any>;
  /** Explicit id for the Input; auto-generated if omitted. */
  inputId?: string;
}) {
  const error = form.formState.errors[field.name]?.message as string | undefined;

  return (
    <Controller
      name={field.name}
      control={form.control}
      render={({ field: controllerField }) => (
        <Input
          {...controllerField}
          id={inputId}
          type="number"
          label={field.label}
          placeholder={field.placeholder}
          disabled={field.disabled}
          readOnly={field.readonly}
          required={field.required}
          error={error}
          helperText={field.description}
          min={field.min}
          max={field.max}
          step={field.step}
          fullWidth
          onChange={(e) => {
            const val = e.target.value;
            controllerField.onChange(val === "" ? "" : Number(val));
          }}
        />
      )}
    />
  );
}

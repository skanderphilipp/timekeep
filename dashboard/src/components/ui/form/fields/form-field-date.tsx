import { Controller, type UseFormReturn } from "react-hook-form";

import { DatePicker } from "@/components/ui/date-picker";
import type { FormDateFieldDef } from "@/components/ui/form/form-field-def";

/**
 * Date form field — self-contained DatePicker, no FormField wrapper.
 *
 * DatePicker handles its own label, error, helper text, calendar popup,
 * presets, and clear button. Twenty-aligned.
 */
export function FormFieldDate({
  field,
  form,
}: {
  field: FormDateFieldDef;
  form: UseFormReturn<any>;
  inputId?: string;
}) {
  const error = form.formState.errors[field.name]?.message as string | undefined;

  return (
    <Controller
      name={field.name}
      control={form.control}
      render={({ field: controllerField }) => (
        <DatePicker
          label={field.label}
          error={error}
          helperText={field.description}
          required={field.required}
          value={controllerField.value as Date | null}
          onChange={(date) => controllerField.onChange(date)}
          placeholder={field.placeholder}
          minDate={field.minDate}
          maxDate={field.maxDate}
          fullWidth
        />
      )}
    />
  );
}

import { Controller, type UseFormReturn } from "react-hook-form";

import { MultiSelect } from "@/components/ui/multi-select";
import type { FormMultiSelectFieldDef } from "@/components/ui/form/form-field-def";

/**
 * Multi-select form field — self-contained MultiSelect, no FormField wrapper.
 *
 * MultiSelect handles its own label, error, helper text, chips, search,
 * and empty states. Twenty-aligned.
 */
export function FormFieldMultiSelect({
  field,
  form,
}: {
  field: FormMultiSelectFieldDef;
  form: UseFormReturn<any>;
  inputId?: string;
}) {
  const error = form.formState.errors[field.name]?.message as string | undefined;

  return (
    <Controller
      name={field.name}
      control={form.control}
      render={({ field: controllerField }) => (
        <MultiSelect
          label={field.label}
          error={error}
          helperText={field.description}
          required={field.required}
          options={field.options}
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

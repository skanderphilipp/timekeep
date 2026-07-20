import { Controller, type UseFormReturn } from "react-hook-form";

import { Combobox } from "@/components/ui/combobox";
import type { FormSelectFieldDef } from "@/components/ui/form/form-field-def";

/**
 * Select form field — self-contained Combobox, no FormField wrapper.
 *
 * Combobox handles its own label, error, helper text, search/filter,
   * loading, and empty states.
 */
export function FormFieldSelect({
  field,
  form,
}: {
  field: FormSelectFieldDef;
  form: UseFormReturn<any>;
  inputId?: string;
}) {
  const error = form.formState.errors[field.name]?.message as string | undefined;

  return (
    <Controller
      name={field.name}
      control={form.control}
      render={({ field: controllerField }) => (
        <Combobox
          label={field.label}
          error={error}
          helperText={field.description}
          required={field.required}
          options={field.options}
          value={controllerField.value as string | undefined}
          onChange={controllerField.onChange}
          placeholder={field.placeholder}
          disabled={field.disabled}
          searchable={field.searchable ?? field.options.length > 8}
          fullWidth
        />
      )}
    />
  );
}

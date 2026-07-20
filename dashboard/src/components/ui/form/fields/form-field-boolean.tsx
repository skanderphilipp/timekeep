import { Controller, type UseFormReturn } from "react-hook-form";

import { Switch } from "@/components/ui/switch";
import type { FormBooleanFieldDef } from "@/components/ui/form/form-field-def";

/**
 * Boolean form field — self-contained Switch, no FormField wrapper.
 *
 * Switch handles its own fieldLabel, inline toggle label, error,
   * and helper text. the control is self-contained.
 */
export function FormFieldBoolean({
  field,
  form,
}: {
  field: FormBooleanFieldDef;
  form: UseFormReturn<any>;
  inputId?: string;
}) {
  const error = form.formState.errors[field.name]?.message as string | undefined;

  return (
    <Controller
      name={field.name}
      control={form.control}
      render={({ field: controllerField }) => (
        <Switch
          id={controllerField.name}
          fieldLabel={field.label}
          label={field.description ?? field.label}
          checked={controllerField.value === true}
          onCheckedChange={(checked) => controllerField.onChange(checked)}
          disabled={field.disabled}
          required={field.required}
          error={error}
          helperText={field.disabled ? undefined : field.description}
        />
      )}
    />
  );
}

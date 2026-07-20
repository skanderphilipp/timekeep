import { Controller, type UseFormReturn } from "react-hook-form";

import { ExpiryPicker, type ExpiryValue } from "@/components/ui/expiry-picker";
import type { FormExpiryFieldDef } from "@/components/ui/form/form-field-def";

/**
 * Expiry form field — self-contained, no FormField wrapper.
 *
 * ExpiryPicker handles its own label, error, and helper text.
   * the control is self-contained.
 */
export function FormFieldExpiry({
  field,
  form,
}: {
  field: FormExpiryFieldDef;
  form: UseFormReturn<any>;
  // inputId not needed — ExpiryPicker generates its own id
  inputId?: string;
}) {
  const error = form.formState.errors[field.name]?.message as string | undefined;

  return (
    <Controller
      name={field.name}
      control={form.control}
      render={({ field: controllerField }) => (
        <ExpiryPicker
          label={field.label}
          error={error}
          helperText={field.description}
          value={
            (controllerField.value as ExpiryValue) ?? {
              preset: "never",
              customDate: null,
            }
          }
          onChange={controllerField.onChange}
          disabled={field.disabled}
          fullWidth
        />
      )}
    />
  );
}

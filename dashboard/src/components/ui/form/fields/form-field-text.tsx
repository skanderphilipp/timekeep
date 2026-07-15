import { Controller, type UseFormReturn } from "react-hook-form";

import { Input } from "@/components/ui/input";
import type {
  FormTextFieldDef,
  FormPasswordFieldDef,
} from "@/components/ui/form/form-field-def";

/**
 * Text and password form field (unified).
 *
 * Input handles its own label, error, helperText, and password show/hide
 * toggle — no separate FormField wrapper needed. Twenty-aligned pattern:
 * the input control is self-contained.
 */
export function FormFieldText({
  field,
  form,
  inputId,
}: {
  field: FormTextFieldDef | FormPasswordFieldDef;
  form: UseFormReturn<any>;
  /** Explicit id for the Input; auto-generated if omitted. */
  inputId?: string;
}) {
  const error = form.formState.errors[field.name]?.message as string | undefined;
  const isPassword = field.type === "password";
  const inputType = isPassword
    ? "password"
    : (field as FormTextFieldDef).inputType ?? "text";

  return (
    <Controller
      name={field.name}
      control={form.control}
      render={({ field: controllerField }) => (
        <Input
          {...controllerField}
          id={inputId}
          type={inputType}
          label={field.label}
          placeholder={field.placeholder}
          disabled={field.disabled}
          readOnly={field.readonly}
          required={field.required}
          error={error}
          helperText={field.description}
          autoComplete={isPassword ? "current-password" : undefined}
          fullWidth
        />
      )}
    />
  );
}

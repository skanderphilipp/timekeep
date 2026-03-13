import { useId } from "react";
import type { UseFormReturn } from "react-hook-form";

import type { FormFieldDef } from "@/components/ui/form/form-field-def";
import { FormFieldText } from "@/components/ui/form/fields/form-field-text";
import { FormFieldNumber } from "@/components/ui/form/fields/form-field-number";
import { FormFieldIpPort } from "@/components/ui/form/fields/form-field-ip-port";
import { FormFieldBoolean } from "@/components/ui/form/fields/form-field-boolean";
import { FormFieldSelect } from "@/components/ui/form/fields/form-field-select";
import { FormFieldMultiSelect } from "@/components/ui/form/fields/form-field-multiselect";
import { FormFieldPermissions } from "@/components/ui/form/fields/form-field-permissions";
import { FormFieldExpiry } from "@/components/ui/form/fields/form-field-expiry";
import { FormFieldDate } from "@/components/ui/form/fields/form-field-date";
import { FormFieldPassword } from "@/components/ui/form/fields/form-field-password";

/**
 * Discriminated form field dispatcher.
 *
 * Given a field definition and a react-hook-form instance, renders the
 * correct input control wrapped in FormField + FieldInputContainer.
 * This is the **only** component pages should use to render form fields.
 *
 * Generates a stable `inputId` and passes it to both `FormField` (for
 * accessible `<label htmlFor>`) and the control (for `<input id>`).
 *
 * Ported from pulse's `FormFieldInput` pattern (Twenty's discriminated
 * union field dispatcher).
 *
 * @example
 * ```tsx
 * <FormFieldInput
 *   field={{ type: "text", name: "label", label: "Device Label" }}
 *   form={form}
 * />
 * ```
 */
export function FormFieldInput({
  field,
  form,
}: {
  field: FormFieldDef;
  form: UseFormReturn<any>;
}) {
  const inputId = useId();

  switch (field.type) {
    case "text":
      return <FormFieldText field={field} form={form} inputId={inputId} />;
    case "number":
      return <FormFieldNumber field={field} form={form} inputId={inputId} />;
    case "ip-port":
      return <FormFieldIpPort field={field} form={form} inputId={inputId} />;
    case "boolean":
      return <FormFieldBoolean field={field} form={form} inputId={inputId} />;
    case "select":
      return <FormFieldSelect field={field} form={form} inputId={inputId} />;
    case "multiselect":
      return <FormFieldMultiSelect field={field} form={form} inputId={inputId} />;
    case "permissions":
      return <FormFieldPermissions field={field} form={form} inputId={inputId} />;
    case "expiry":
      return <FormFieldExpiry field={field} form={form} inputId={inputId} />;
    case "date":
      return <FormFieldDate field={field} form={form} inputId={inputId} />;
    case "password":
      return <FormFieldPassword field={field} form={form} inputId={inputId} />;
  }
}

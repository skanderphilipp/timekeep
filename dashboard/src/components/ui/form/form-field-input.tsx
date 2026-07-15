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

/**
 * Discriminated form field dispatcher.
 *
 * Two patterns (Twenty-aligned):
 *
 * ── Self-contained (no FormField wrapper) ──
 *   text, password  → FormFieldText   → Input handles its own label/error
 *   number          → FormFieldNumber → Input handles its own label/error
 *   expiry          → FormFieldExpiry → ExpiryPicker handles its own label/error
 *   ip-port         → FormFieldIpPort → IpPortInput handles its own label/error
 *
 * ── Wrapped (FormField provides label/error) ──
 *   boolean         → Switch has inline toggle label; FormField gives field label
 *   select          → Combobox has no label/error built-in
 *   multiselect     → MultiSelect has no label/error built-in
 *   permissions     → PermissionMultiSelect has no label/error built-in
 *   date            → DatePicker has no label/error built-in
 *
 * inputId is generated once and passed to all fields. Self-contained
 * fields ignore it (their controls generate their own ids). Wrapped
 * fields use it for accessible `<label htmlFor>` association.
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
    // ── Self-contained ──────────────────────────────────────────
    case "text":
    case "password":
      return <FormFieldText field={field} form={form} inputId={inputId} />;
    case "number":
      return <FormFieldNumber field={field} form={form} inputId={inputId} />;
    case "expiry":
      return <FormFieldExpiry field={field} form={form} inputId={inputId} />;
    case "ip-port":
      return <FormFieldIpPort field={field} form={form} inputId={inputId} />;

    // ── Wrapped (FormField provides label/error) ────────────────
    case "boolean":
      return <FormFieldBoolean field={field} form={form} inputId={inputId} />;
    case "select":
      return <FormFieldSelect field={field} form={form} inputId={inputId} />;
    case "multiselect":
      return <FormFieldMultiSelect field={field} form={form} inputId={inputId} />;
    case "permissions":
      return <FormFieldPermissions field={field} form={form} inputId={inputId} />;
    case "date":
      return <FormFieldDate field={field} form={form} inputId={inputId} />;
  }
}

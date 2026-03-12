import type { ComboboxOption } from "@/components/ui/combobox";
import type { MultiSelectOption } from "@/components/ui/multi-select";

/**
 * Discriminated union of all supported form field types.
 *
 * Each variant carries the props needed to render the field
 * and wire it into react-hook-form via Controller.
 */
export type FormFieldDef =
  | FormTextFieldDef
  | FormNumberFieldDef
  | FormIpPortFieldDef
  | FormBooleanFieldDef
  | FormSelectFieldDef
  | FormMultiSelectFieldDef
  | FormPermissionsFieldDef
  | FormExpiryFieldDef
  | FormDateFieldDef
  | FormPasswordFieldDef;

// ── Common props shared by all field types ───────────────────────────

interface FormFieldBase {
  /** Field label (rendered above the control). */
  label: string;
  /** Short hint below the label. */
  description?: string;
  /** Mark as required (shows asterisk). */
  required?: boolean;
  /** Makes the field read-only. */
  readonly?: boolean;
  /** Makes the field disabled. */
  disabled?: boolean;
  /** Placeholder text for the input. */
  placeholder?: string;
}

// ── Text field ───────────────────────────────────────────────────────

export interface FormTextFieldDef extends FormFieldBase {
  type: "text";
  /** react-hook-form field name. */
  name: string;
  /** HTML input type (text, email, url). */
  inputType?: "text" | "email" | "url";
}

// ── Number field ─────────────────────────────────────────────────────

export interface FormNumberFieldDef extends FormFieldBase {
  type: "number";
  name: string;
  min?: number;
  max?: number;
  step?: number;
}

// ── IP:Port composite field ──────────────────────────────────────────

export interface FormIpPortFieldDef extends FormFieldBase {
  type: "ip-port";
  /** [ipFieldName, portFieldName] — two form field names. */
  name: [string, string];
}

// ── Boolean/Toggle field ─────────────────────────────────────────────

export interface FormBooleanFieldDef extends FormFieldBase {
  type: "boolean";
  name: string;
}

// ── Select field ─────────────────────────────────────────────────────

export interface FormSelectFieldDef extends FormFieldBase {
  type: "select";
  name: string;
  options: ComboboxOption[];
  searchable?: boolean;
}

// ── Multi-select field ───────────────────────────────────────────────

export interface FormMultiSelectFieldDef extends FormFieldBase {
  type: "multiselect";
  name: string;
  options: MultiSelectOption[];
}

// ── Permissions multi-select (pre-populated from lib/permissions) ────

export interface FormPermissionsFieldDef extends FormFieldBase {
  type: "permissions";
  name: string;
}

// ── Expiry picker field ──────────────────────────────────────────────

export interface FormExpiryFieldDef extends FormFieldBase {
  type: "expiry";
  name: string;
}

// ── Date picker field ────────────────────────────────────────────────

export interface FormDateFieldDef extends FormFieldBase {
  type: "date";
  name: string;
  minDate?: Date;
  maxDate?: Date;
}

// ── Password field ───────────────────────────────────────────────────

export interface FormPasswordFieldDef extends FormFieldBase {
  type: "password";
  name: string;
}

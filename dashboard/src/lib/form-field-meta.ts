import type { z } from "zod";

import type {
  FormFieldDef,
  FormTextFieldDef,
  FormNumberFieldDef,
  FormBooleanFieldDef,
  FormSelectFieldDef,
} from "@/components/ui/form/form-field-def";

// ── Types ───────────────────────────────────────────────────────────────────────

/**
 * UI metadata for a single form field.
 *
 * The Zod schema provides validation (type, required, min/max, enums).
 * This companion object provides display-only metadata: labels,
 * descriptions, placeholders, section assignment, and widget overrides.
 *
 * Fields that map to simple Zod types (string → text, number → number,
 * boolean → toggle, enum → select) do NOT need an explicit `widget` —
 * it is auto-detected from the Zod schema.
 *
 * Only declare `widget` for: password, date, expiry, permissions,
 * multiselect, ip-port, or when you want to override auto-detection.
 *
 * **Schema-only fields** (API fields with no UI): omit them from the meta
 * map entirely. They participate in validation but won't render a form control.
 */
export interface FormFieldMetaEntry {
  /** i18n'd field label. */
  label: string;
  /** Helper text below the label. */
  description?: string;
  /** Placeholder inside the input. */
  placeholder?: string;
  /**
   * Explicit widget type. Overrides Zod type auto-detection.
   * Required for: password, date, expiry, permissions, multiselect, ip-port.
   */
  widget?: FormFieldDef["type"];
  /** Section key this field belongs to (must match a FormSectionDef.key). */
  section?: string;
  /** Options for select/multiselect fields. Auto-populated from Zod enum if omitted. */
  options?: Array<{ value: string; label: string }>;
  /**
   * For composite fields (ip-port): the two Zod field names to pair.
   * The consumed field (e.g., `port`) should NOT have its own meta entry.
   */
  composite?: [string, string];
  /** Disabled state (e.g., fields that are read-only during edit). */
  disabled?: boolean;
  /** Read-only state. */
  readonly?: boolean;
  /** Override the auto-detected required state. */
  required?: boolean;
  /** Mark this field as hidden (validated but not rendered). */
  hidden?: boolean;
}

/**
 * Section definition for the {@link SchemaForm} renderer.
 *
 * Sections are rendered in array order. Each section contains the
 * fields whose {@link FormFieldMetaEntry.section} matches its key.
 */
export interface FormSectionDef {
  /** Key that matches {@link FormFieldMetaEntry.section}. */
  key: string;
  /** i18n'd section heading. */
  title: string;
  /** Optional section description rendered below the heading. */
  description?: string;
}

/**
 * Complete form schema definition — bundles Zod validation with UI metadata.
 *
 * This is the single source of truth for a form. Define one per module
 * (in `schemas/`) and consume it from both the hook (for validation)
 * and the component (for rendering).
 *
 * @example
 * ```ts
 * export const deviceFormDef: FormSchemaDefinition = {
 *   schema: createDeviceFormSchema,
 *   fields: {
 *     serial_number: { label: "Serial Number", section: "identity" },
 *     host: { label: "Host", widget: "ip-port", composite: ["host", "port"], section: "connection" },
 *   },
 *   sections: [
 *     { key: "identity", title: "Device Identity", description: "..." },
 *     { key: "connection", title: "Connection", description: "..." },
 *   ],
 * };
 * ```
 */
export interface FormSchemaDefinition {
  /**
   * Zod validation schema factory.
   *
   * Must be a function (not a pre-created schema) because it accepts an
   * i18n translation function for translated error messages. The parameter
   * is `(msg: string) => string` — compatible with both Lingui's `_` and
   * plain identity functions used in introspection.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  schema: (msgFn: (msg: any) => string) => z.ZodObject<z.ZodRawShape>;
  /** Per-field UI metadata. Keys are Zod field names. */
  fields: Record<string, FormFieldMetaEntry>;
  /** Sections in display order. */
  sections: FormSectionDef[];
}

// ── Zod introspection (internal) ─────────────────────────────────────────────────

/**
 * Unwrap optional/nullable/default wrappers to get the inner Zod type.
 *
 * Zod 4.x compat: prefers `unwrap()` / `removeDefault()` methods,
 * falls back to `_def.innerType` for older Zod versions.
 */
function unwrapZodType(field: z.ZodTypeAny): z.ZodTypeAny {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const def = (field as any)._def;
  if (!def) return field;

  // Zod 4.x: `_def.type` is lowercase ("optional", "nullable", "default")
  // Zod 3.x: `_def.typeName` is PascalCase ("ZodOptional", "ZodNullable", "ZodDefault")
  const typeName: string = def.type ?? def.typeName ?? "";

  if (typeName === "optional" || typeName === "ZodOptional" || typeName === "nullable" || typeName === "ZodNullable") {
    // Zod 4 exposes `.unwrap()` on wrappers
    if (typeof (field as unknown as { unwrap?: () => z.ZodTypeAny }).unwrap === "function") {
      return unwrapZodType((field as unknown as { unwrap(): z.ZodTypeAny }).unwrap());
    }
    if (def.innerType) return unwrapZodType(def.innerType);
  }

  if (typeName === "default" || typeName === "ZodDefault") {
    // Zod 4: `removeDefault()` returns the inner schema without the default
    if (typeof (field as unknown as { removeDefault?: () => z.ZodTypeAny }).removeDefault === "function") {
      return unwrapZodType((field as unknown as { removeDefault(): z.ZodTypeAny }).removeDefault());
    }
    if (def.innerType) return unwrapZodType(def.innerType);
  }

  return field;
}

/** Infer the widget type from a Zod schema field. Returns null if detection fails. */
function inferWidgetType(field: z.ZodTypeAny): FormFieldDef["type"] | null {
  const inner = unwrapZodType(field);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const zodDef = (inner as any)._def;
  if (!zodDef) return null;

  // Zod 4.x uses lowercase `_def.type`, Zod 3.x uses PascalCase `_def.typeName`
  const typeName: string = zodDef.type ?? zodDef.typeName ?? "";

  switch (typeName) {
    case "string":
    case "ZodString":
      return "text";
    case "number":
    case "ZodNumber":
      return "number";
    case "boolean":
    case "ZodBoolean":
      return "boolean";
    case "enum":
    case "ZodEnum":
    case "ZodNativeEnum":
      return "select";
    case "array":
    case "ZodArray":
      return "multiselect";
    case "date":
    case "ZodDate":
      return "date";
    default:
      return null;
  }
}

/** Check if a Zod field is required (not optional, not nullable, not with default). */
function isZodFieldRequired(field: z.ZodTypeAny): boolean {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const def = (field as any)._def;
  if (!def) return true;

  // Zod 4.x uses lowercase `_def.type`, Zod 3.x uses PascalCase `_def.typeName`
  const typeName: string = def.type ?? def.typeName ?? "";
  if (
    typeName === "optional" || typeName === "ZodOptional" ||
    typeName === "nullable" || typeName === "ZodNullable" ||
    typeName === "default" || typeName === "ZodDefault"
  ) {
    return false;
  }
  return true;
}

/** Extract min constraint from ZodNumber or ZodString checks. */
function extractMinConstraint(field: z.ZodTypeAny): number | undefined {
  const inner = unwrapZodType(field);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const checks: Array<{ kind?: string; value?: number; _zod?: { def?: Record<string, unknown> } }> | undefined =
    (inner as any)._def?.checks;
  if (!checks) return undefined;

  for (const check of checks) {
    // Zod 4.x: check data is in `_zod.def` with `check: "greater_than"` (number) or "min_length" (string)
    const zd = check._zod?.def;
    if (zd) {
      if (zd.check === "greater_than" && typeof zd.value === "number") return zd.value;
      if (zd.check === "min_length" && typeof zd.minimum === "number") return zd.minimum;
      continue;
    }
    // Zod 3.x: check.kind === "min" with check.value
    if (check.kind === "min" && check.value !== undefined) {
      return check.value;
    }
  }
  return undefined;
}

/** Extract max constraint from ZodNumber or ZodString checks. */
function extractMaxConstraint(field: z.ZodTypeAny): number | undefined {
  const inner = unwrapZodType(field);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const checks: Array<{ kind?: string; value?: number; _zod?: { def?: Record<string, unknown> } }> | undefined =
    (inner as any)._def?.checks;
  if (!checks) return undefined;

  for (const check of checks) {
    // Zod 4.x: check data is in `_zod.def` with `check: "less_than"` (number) or "max_length" (string)
    const zd = check._zod?.def;
    if (zd) {
      if (zd.check === "less_than" && typeof zd.value === "number") return zd.value;
      if (zd.check === "max_length" && typeof zd.maximum === "number") return zd.maximum;
      continue;
    }
    // Zod 3.x: check.kind === "max" with check.value
    if (check.kind === "max" && check.value !== undefined) {
      return check.value;
    }
  }
  return undefined;
}

/** Extract enum values from a ZodEnum or ZodNativeEnum field. */
function extractEnumValues(field: z.ZodTypeAny): string[] | undefined {
  const inner = unwrapZodType(field);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const zodDef = (inner as any)._def;
  if (!zodDef) return undefined;

  // Zod 4.x uses lowercase `_def.type`, Zod 3.x uses PascalCase `_def.typeName`
  const typeName: string = zodDef.type ?? zodDef.typeName ?? "";
  if (
    typeName === "enum" || typeName === "ZodEnum" ||
    typeName === "ZodNativeEnum"
  ) {
    // Zod 4.x: enum values are in `_def.entries` (object like {a: "a", b: "b"})
    // Zod 3.x: enum values are in `_def.values` (string[])
    const entries = zodDef.entries;
    if (entries && typeof entries === "object") return Object.values(entries) as string[];
    const values = zodDef.values;
    if (Array.isArray(values)) return values;
    if (values && typeof values === "object") return Object.values(values) as string[];
  }
  return undefined;
}

// ── Public API ───────────────────────────────────────────────────────────────────

/**
 * Generate `FormFieldDef[]` from a Zod schema + UI metadata.
 *
 * This is the bridge between validation (Zod) and rendering (FormFieldDef).
 * It inspects the Zod schema to infer field types, required/optional state,
 * min/max constraints, and enum options, then merges with the meta map for
 * labels, descriptions, placeholders, and widget overrides.
 *
 * Composite fields (ip-port): the meta entry for the first field name must
 * have `widget: "ip-port"` and `composite: [fieldA, fieldB]`. The second
 * field name is consumed and MUST NOT have its own meta entry.
 *
 * @param def — The form schema definition (schema + meta + sections).
 * @param overrides — Optional per-field overrides for dynamic states
 *   (e.g., `disabled: isEditing`). Applied after meta is resolved.
 */
export function createFormFieldDefs(
  def: FormSchemaDefinition,
  overrides?: Record<string, { disabled?: boolean; readonly?: boolean }>,
): FormFieldDef[] {
  // Create a throwaway schema instance (i18n messages don't matter for structure)
  const dummyI18n = (msg: string) => msg;
  const schemaInstance = def.schema(dummyI18n);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const shape = schemaInstance.shape as Record<string, z.ZodTypeAny>;

  const consumedFields = new Set<string>();
  const result: FormFieldDef[] = [];

  for (const [fieldName, zodField] of Object.entries(shape)) {
    // Skip fields consumed by composite widgets
    if (consumedFields.has(fieldName)) continue;

    const meta: FormFieldMetaEntry | undefined = def.fields[fieldName];

    // Skip schema-only fields (validated but not rendered)
    if (!meta) continue;

    // Skip explicitly hidden fields
    if (meta.hidden) continue;

    // Determine widget type: explicit override > inference > "text" fallback
    const widget: FormFieldDef["type"] | null | undefined =
      meta?.widget ?? inferWidgetType(zodField);

    if (!widget) {
      // Cannot determine widget — skip with a warning in dev
      if (import.meta.env.DEV) {
        // eslint-disable-next-line no-console
        console.warn(
          `[createFormFieldDefs] Cannot infer widget for field "${fieldName}". ` +
            `Add an explicit 'widget' in the meta map.`,
        );
      }
      continue;
    }

    // Handle composite fields (ip-port)
    if (widget === "ip-port" && meta?.composite) {
      const [first, second] = meta.composite;
      consumedFields.add(second);

      result.push({
        type: "ip-port",
        name: [first, second],
        label: meta.label,
        description: meta.description,
        placeholder: meta.placeholder,
        required: isZodFieldRequired(zodField),
        disabled: meta.disabled,
        readonly: meta.readonly,
      });
      continue;
    }

    // Build the field definition based on widget type
    const base = {
      label: meta?.label ?? fieldName,
      description: meta?.description,
      placeholder: meta?.placeholder,
      required: meta?.required ?? isZodFieldRequired(zodField),
      disabled: meta?.disabled,
      readonly: meta?.readonly,
    };

    switch (widget) {
      case "text": {
        result.push({
          type: "text",
          name: fieldName,
          inputType: "text",
          ...base,
        } satisfies FormTextFieldDef);
        break;
      }
      case "number": {
        result.push({
          type: "number",
          name: fieldName,
          min: extractMinConstraint(zodField),
          max: extractMaxConstraint(zodField),
          ...base,
        } satisfies FormNumberFieldDef);
        break;
      }
      case "boolean": {
        result.push({
          type: "boolean",
          name: fieldName,
          ...base,
        } satisfies FormBooleanFieldDef);
        break;
      }
      case "select": {
        const enumValues = extractEnumValues(zodField);
        const options: Array<{ value: string; label: string }> =
          meta?.options ??
          enumValues?.map((v) => ({ value: v, label: v })) ??
          [];
        result.push({
          type: "select",
          name: fieldName,
          options,
          ...base,
        } satisfies FormSelectFieldDef);
        break;
      }
      case "password":
      case "date":
      case "expiry":
      case "permissions":
      case "multiselect": {
        // These types are fully defined by the meta — no schema inspection needed
        // Use a cast because the discriminated union is satisfied at runtime
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        result.push({
          type: widget,
          name: fieldName,
          ...base,
          options: meta?.options,
        } as any);
        break;
      }
      default:
        break;
    }
  }

  // Apply dynamic overrides
  if (overrides) {
    for (const field of result) {
      const key = resolveFieldName(field);
      const ov = overrides[key];
      if (ov) {
        if (ov.disabled !== undefined) field.disabled = ov.disabled;
        if (ov.readonly !== undefined) field.readonly = ov.readonly;
      }
    }
  }

  return result;
}

/**
 * Resolve the canonical field name from a FormFieldDef.
 *
 * For simple fields, returns `field.name` as-is.
 * For composite fields (ip-port), returns the first element.
 */
export function resolveFieldName(field: FormFieldDef): string {
  if (field.type === "ip-port") return field.name[0];
  return field.name as string;
}

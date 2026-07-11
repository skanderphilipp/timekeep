import { useMemo } from "react";
import type { UseFormReturn } from "react-hook-form";

import { FormSection } from "./form-section";
import { FormFieldInput } from "./form-field-input";
import {
  createFormFieldDefs,
  resolveFieldName,
  type FormSchemaDefinition,
} from "@/lib/form-field-meta";

type SchemaFormProps = {
  /** Bundled schema + meta + sections definition. */
  formSchema: FormSchemaDefinition;
  /** react-hook-form instance (from useZodForm). */
  form: UseFormReturn<any>;
  /**
   * Per-field dynamic overrides (e.g., `disabled: isEditing`).
   * Applied on top of the static meta. Keys are Zod field names.
   */
  fieldOverrides?: Record<string, { disabled?: boolean; readonly?: boolean }>;
};

/**
 * Schema-driven form renderer.
 *
 * Generates `FormFieldDef[]` from the Zod schema + meta map, groups fields
 * by section, and renders each section with `FormSection` + `FormFieldInput`.
 *
 * This is the **single rendering path** for all forms in the app. Pages
 * should compose this component — never manually declare FormFieldDef[]
 * arrays or loop over fields themselves.
 *
 * @example
 * ```tsx
 * import { deviceFormSchema } from "../schemas/device-form.schema";
 *
 * function DeviceForm() {
 *   const { form, handleSubmit } = useDeviceForm();
 *   return (
 *     <Form onSubmit={handleSubmit}>
 *       <SchemaForm formSchema={deviceFormSchema} form={form} />
 *       <FormActions>...</FormActions>
 *     </Form>
 *   );
 * }
 * ```
 */
export function SchemaForm({ formSchema, form, fieldOverrides }: SchemaFormProps) {
  // Memoize field def generation — only re-runs when formSchema or overrides change.
  // The formSchema object should be stable (module-level const or useMemo'd).
  const { sectionMap, fieldDefs } = useMemo(() => {
    const fields = createFormFieldDefs(formSchema, fieldOverrides);

    // Build section → fields map
    const map = new Map<string, typeof fields>();
    const fallbackSection = formSchema.sections[0]?.key ?? "main";

    for (const field of fields) {
      const key = resolveFieldName(field);
      const sectionKey = formSchema.fields[key]?.section ?? fallbackSection;
      if (!map.has(sectionKey)) map.set(sectionKey, []);
      map.get(sectionKey)!.push(field);
    }

    return { sectionMap: map, fieldDefs: fields };
  }, [formSchema, fieldOverrides]);

  // Warn if no field defs were generated
  if (fieldDefs.length === 0) {
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.warn(
        "[SchemaForm] No fields generated from schema. Check your FormFieldMeta entries.",
      );
    }
  }

  return (
    <>
      {formSchema.sections.map((section) => {
        const fields = sectionMap.get(section.key);
        if (!fields || fields.length === 0) return null;

        return (
          <FormSection key={section.key} title={section.title} description={section.description}>
            {fields.map((field) => (
              <FormFieldInput key={resolveFieldName(field)} field={field} form={form} />
            ))}
          </FormSection>
        );
      })}
    </>
  );
}

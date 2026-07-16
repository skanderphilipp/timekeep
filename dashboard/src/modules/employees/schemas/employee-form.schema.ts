import { z } from "zod";
import { msg } from "@lingui/core/macro";
import type { I18n } from "@lingui/core";

import type { FormSchemaDefinition } from "@/lib/form-field-meta";

/**
 * Creates a Zod validation schema for the employee add/edit form.
 *
 * PIN: numeric string, 1-9 digits, unique (server-validated).
 * Name: required, non-empty.
 * Department ID: optional UUID reference to departments table.
 * External ID: optional, for ERP/HRIS integration.
 */
export function createEmployeeFormSchema(_: I18n["_"]) {
  return z.object({
    pin: z
      .string({ message: _(msg`PIN is required`) })
      .min(1, _(msg`PIN is required`))
      .max(20, _(msg`PIN must be 20 characters or fewer`))
      .regex(/^\d+$/, _(msg`PIN must contain only digits`)),
    name: z
      .string({ message: _(msg`Name is required`) })
      .min(1, _(msg`Name is required`))
      .max(200, _(msg`Name must be 200 characters or fewer`)),
    department_id: z.string().optional().default(""),
    external_id: z.string().optional().default(""),
  });
}

export type EmployeeFormValues = z.infer<ReturnType<typeof createEmployeeFormSchema>>;

// ── Form schema definition (Zod + UI metadata + sections) ────────────────────────

/**
 * Creates the complete form schema definition for the employee add/edit form.
 *
 * Bundles Zod validation, per-field UI metadata (labels, descriptions,
 * widget types), and section layout. This is the single source of truth
 * for the employee form — consumed by both `useEmployeeForm` (validation)
 * and `<SchemaForm>` (rendering).
 *
 * `department_id` is hidden from SchemaForm because it renders as a custom
 * Combobox populated from the departments API (not a static select).
 */
export function createEmployeeFormDef(_: I18n["_"]) {
  const def: FormSchemaDefinition = {
    schema: createEmployeeFormSchema,
    fields: {
      pin: {
        label: _(msg`PIN`),
        description: _(msg`Numeric employee ID used on the biometric scanner (e.g., 1001)`),
        placeholder: _(msg`1001`),
        section: "identity",
      },
      name: {
        label: _(msg`Full Name`),
        description: _(msg`Employee's full name as displayed in reports`),
        placeholder: _(msg`John Doe`),
        section: "identity",
      },
      department_id: {
        label: _(msg`Department`),
        description: _(msg`Organizational unit (optional — leave empty if unassigned)`),
        section: "identity",
        hidden: true,
      },
      external_id: {
        label: _(msg`External ID`),
        description: _(msg`Identifier from external HR/ERP system (optional)`),
        placeholder: _(msg`EMP-001`),
        section: "identity",
      },
    },
    sections: [
      {
        key: "identity",
        title: _(msg`Employee Identity`),
        description: _(msg`Unique PIN, full name, and external reference for this employee.`),
      },
    ],
  } as const;

  return def;
}

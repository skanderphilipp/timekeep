import { z } from "zod";
import { msg } from "@lingui/core/macro";
import type { I18n } from "@lingui/core";

import type { FormSchemaDefinition } from "@/lib/form-field-meta";

/**
 * Creates a Zod validation schema for the employee add/edit form.
 *
 * PIN: numeric string, 1-9 digits, unique (server-validated).
 * Name: required, non-empty.
 * Department: optional free-text (until FK migration to departments table).
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
    department: z.string().optional().default(""),
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
      department: {
        label: _(msg`Department`),
        description: _(msg`Organizational unit (e.g., Warehouse, Office)`),
        placeholder: _(msg`Warehouse`),
        section: "organization",
      },
      external_id: {
        label: _(msg`External ID`),
        description: _(msg`Identifier from external HR/ERP system (optional)`),
        placeholder: _(msg`EMP-001`),
        section: "organization",
      },
    },
    sections: [
      {
        key: "identity",
        title: _(msg`Employee Identity`),
        description: _(msg`Unique PIN and full name for this employee.`),
      },
      {
        key: "organization",
        title: _(msg`Organization`),
        description: _(msg`Department assignment and external system reference.`),
      },
    ],
  } as const;

  return def;
}

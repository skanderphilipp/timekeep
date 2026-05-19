import { z } from "zod";
import { msg } from "@lingui/core/macro";
import type { I18n } from "@lingui/core";
import { ROLES } from "@shared/roles";
import type { FormSchemaDefinition } from "@/lib/form-field-meta";

/**
 * Creates a Zod validation schema for the user create/edit form.
 *
 * Accepts the Lingui i18n instance so validation error messages are
 * internationalized.
 */
export function createUserFormSchema(_: I18n["_"]) {
  const roleValues = ROLES as unknown as [string, ...string[]];
  return z.object({
    username: z
      .string({ message: _(msg`Username is required`) })
      .min(1, _(msg`Username is required`))
      .min(3, _(msg`Username must be at least 3 characters`)),
    password: z
      .string()
      .min(6, _(msg`Password must be at least 6 characters`))
      .optional()
      .default(""),
    display_name: z.string().optional().default(""),
    role: z.enum(roleValues).default("viewer"),
    active: z.boolean().default(true),
  });
}

export type UserFormValues = z.infer<ReturnType<typeof createUserFormSchema>>;

// ── Form schema definition (Zod + UI metadata + sections) ────────────────────────

/**
 * Creates the complete form schema definition for the user create/edit form.
 *
 * Bundles Zod validation, per-field UI metadata, and section layout.
 * This is the **single source of truth** for the user form. The page
 * composes `<SchemaForm>` — it never declares fields manually.
 *
 * @param isEditing — When true, password field is omitted (it's handled by
 *   a separate change-password dialog) and the active toggle is shown instead.
 */
export function createUserFormDef(_: I18n["_"], isEditing: boolean) {
  const ROLE_LABELS: Record<string, string> = {
    admin: _(msg`Admin`),
    operator: _(msg`Operator`),
    viewer: _(msg`Viewer`),
  };

  const ROLE_OPTIONS = ROLES.map((role) => ({
    value: role,
    label: ROLE_LABELS[role] ?? role,
  }));

  const fields: FormSchemaDefinition["fields"] = {
    username: {
      label: _(msg`Username`),
      description: _(msg`Login username (must be unique)`),
      placeholder: _(msg`john.doe`),
      section: "identity",
    },
    display_name: {
      label: _(msg`Display Name`),
      description: _(msg`Full name shown in the interface`),
      placeholder: _(msg`John Doe`),
      section: "identity",
    },
    role: {
      label: _(msg`Role`),
      description: _(msg`Determines what the user can access`),
      widget: "select",
      options: ROLE_OPTIONS,
      section: "access",
    },
  };

  if (isEditing) {
    fields.active = {
      label: _(msg`Active`),
      description: _(msg`Inactive users cannot log in`),
      section: "access",
    };
  } else {
    fields.password = {
      label: _(msg`Password`),
      description: _(msg`Minimum 6 characters`),
      placeholder: _(msg`Password`),
      widget: "password",
      section: "access",
    };
  }

  return {
    schema: createUserFormSchema,
    fields,
    sections: [
      {
        key: "identity",
        title: _(msg`Identity`),
        description: _(msg`Username and display name for this dashboard user.`),
      },
      {
        key: "access",
        title: _(msg`Access`),
        description: _(msg`Role, password, and activation status.`),
      },
    ],
  } satisfies FormSchemaDefinition;
}

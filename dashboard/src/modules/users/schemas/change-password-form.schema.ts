import { z } from "zod";
import { msg } from "@lingui/core/macro";
import type { I18n } from "@lingui/core";

import type { FormSchemaDefinition } from "@/lib/form-field-meta";

// ── Zod validation schema ──────────────────────────────────────────────────────

/** Form values for the change password dialog. */
export function createChangePasswordSchema(_: I18n["_"]) {
  return z.object({
    password: z
      .string({ message: _(msg`Password is required`) })
      .min(6, _(msg`Password must be at least 6 characters`)),
  });
}

export type ChangePasswordFormValues = z.infer<
  ReturnType<typeof createChangePasswordSchema>
>;

// ── Form schema definition ─────────────────────────────────────────────────────

/**
 * Creates the complete form schema definition for the change password dialog.
 */
export function createChangePasswordFormDef(_: I18n["_"]) {
  return {
    schema: createChangePasswordSchema,
    fields: {
      password: {
        label: _(msg`New Password`),
        description: _(msg`Minimum 6 characters.`),
        placeholder: _(msg`New password`),
        widget: "password" as const,
        section: "main",
      },
    },
    sections: [
      {
        key: "main",
        title: _(msg`Change Password`),
        description: _(msg`Set a new password for this user.`),
      },
    ],
  } satisfies FormSchemaDefinition;
}

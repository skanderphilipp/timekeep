import { z } from "zod";
import { msg } from "@lingui/core/macro";
import type { I18n } from "@lingui/core";

import type { FormSchemaDefinition } from "@/lib/form-field-meta";

// ── Zod validation schema ──────────────────────────────────────────────────────

/**
 * Validation schema for the initial setup form.
 *
 * Creates the first admin user — username and password required.
 */
export function createSetupFormSchema(_: I18n["_"]) {
  return z.object({
    username: z
      .string({ message: _(msg`Username is required`) })
      .min(1, _(msg`Username is required`))
      .min(3, _(msg`Username must be at least 3 characters`)),
    password: z
      .string({ message: _(msg`Password is required`) })
      .min(6, _(msg`Password must be at least 6 characters`)),
  });
}

export type SetupFormValues = z.infer<
  ReturnType<typeof createSetupFormSchema>
>;

// ── Form schema definition ─────────────────────────────────────────────────────

/**
 * Creates the complete form schema definition for the setup form.
 */
export function createSetupFormDef(_: I18n["_"]) {
  return {
    schema: createSetupFormSchema,
    fields: {
      username: {
        label: _(msg`Admin Username`),
        description: _(msg`Choose a secure username for the administrator account.`),
        placeholder: _(msg`admin`),
        section: "credentials",
      },
      password: {
        label: _(msg`Admin Password`),
        description: _(msg`Minimum 6 characters. Store this safely.`),
        placeholder: _(msg`Password`),
        widget: "password" as const,
        section: "credentials",
      },
    },
    sections: [
      {
        key: "credentials",
        title: _(msg`Create Admin Account`),
        description: _(msg`Set up the initial administrator credentials for Attendance OS.`),
      },
    ],
  } satisfies FormSchemaDefinition;
}

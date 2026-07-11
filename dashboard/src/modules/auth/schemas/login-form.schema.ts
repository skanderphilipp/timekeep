import { z } from "zod";
import { msg } from "@lingui/core/macro";
import type { I18n } from "@lingui/core";

import type { FormSchemaDefinition } from "@/lib/form-field-meta";

// ── Zod validation schema ──────────────────────────────────────────────────────

/**
 * Validation schema for the login form.
 *
 * Simple schema — only two fields. Previously validation was done inline
 * with register() options, now centralized in Zod.
 */
export function createLoginFormSchema(_: I18n["_"]) {
  return z.object({
    username: z
      .string({ message: _(msg`Username is required`) })
      .min(1, _(msg`Username is required`)),
    password: z
      .string({ message: _(msg`Password is required`) })
      .min(1, _(msg`Password is required`)),
  });
}

export type LoginFormValues = z.infer<ReturnType<typeof createLoginFormSchema>>;

// ── Form schema definition ─────────────────────────────────────────────────────

/**
 * Creates the complete form schema definition for the login form.
 */
export function createLoginFormDef(_: I18n["_"]) {
  return {
    schema: createLoginFormSchema,
    fields: {
      username: {
        label: _(msg`Username`),
        placeholder: _(msg`admin`),
        section: "credentials",
      },
      password: {
        label: _(msg`Password`),
        placeholder: _(msg`Password`),
        widget: "password" as const,
        section: "credentials",
      },
    },
    sections: [
      {
        key: "credentials",
        title: _(msg`Sign in`),
        description: _(msg`Enter your credentials to access the dashboard`),
      },
    ],
  } satisfies FormSchemaDefinition;
}

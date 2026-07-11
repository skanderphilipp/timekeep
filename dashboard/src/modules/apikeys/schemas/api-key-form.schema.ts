import { z } from "zod";
import { msg } from "@lingui/core/macro";
import type { I18n } from "@lingui/core";

import type { FormSchemaDefinition } from "@/lib/form-field-meta";
import type { ExpiryValue } from "@/components/ui/expiry-picker";

// ── Zod validation schema ──────────────────────────────────────────────────────

/**
 * Form values for the API key creation dialog.
 *
 * Note: `permissions` is a string[] in the form (multi-select) and gets
 * joined with spaces before submission. `expiry` is an ExpiryValue that
 * gets converted to `expires_in_days` for the API.
 */
export function createApiKeyFormSchema(_: I18n["_"]) {
  return z.object({
    name: z.string({ message: _(msg`Name is required`) }).min(1, _(msg`Name is required`)),
    permissions: z.array(z.string()).default(["read:punches"]),
    expiry: z
      .object({
        preset: z.string(),
        customDate: z.date().nullable(),
      })
      .default({ preset: "never", customDate: null }) as z.ZodType<ExpiryValue>,
  });
}

export type ApiKeyFormValues = z.infer<ReturnType<typeof createApiKeyFormSchema>>;

// ── Form schema definition (Zod + UI metadata + sections) ──────────────────────

/**
 * Creates the complete form schema definition for the API key creation dialog.
 */
export function createApiKeyFormDef(_: I18n["_"]) {
  return {
    schema: createApiKeyFormSchema,
    fields: {
      name: {
        label: _(msg`Name`),
        description: _(msg`Human-readable name for this API key`),
        placeholder: _(msg`e.g. Odoo Production Integration`),
        section: "main",
      },
      permissions: {
        label: _(msg`Permissions`),
        description: _(msg`Scoped permissions for this API key.`),
        widget: "permissions",
        placeholder: _(msg`Select permissions…`),
        section: "main",
      },
      expiry: {
        label: _(msg`Expiry`),
        description: _(msg`When this API key expires. Choose "No expiry" for permanent keys.`),
        widget: "expiry",
        section: "main",
      },
    },
    sections: [
      {
        key: "main",
        title: _(msg`New API Key`),
        description: _(msg`Create a key for an integration partner.`),
      },
    ],
  } satisfies FormSchemaDefinition;
}

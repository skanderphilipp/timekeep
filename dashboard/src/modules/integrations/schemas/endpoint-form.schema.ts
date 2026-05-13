import { z } from "zod";
import { msg } from "@lingui/core/macro";
import type { I18n } from "@lingui/core";
import { INTEGRATION_KINDS } from "@shared/integration-kinds";
import type { FormSchemaDefinition } from "@/lib/form-field-meta";

export function createEndpointSchema(_: I18n["_"]) {
  const kindValues = INTEGRATION_KINDS.map((k) => k.value) as [string, ...string[]];
  return z.object({
    name: z.string({ message: _(msg`Name is required`) }).min(1, _(msg`Name is required`)),
    kind: z.enum(kindValues),
    url: z.string().optional().default(""),
    config_json: z.string().optional().default(""),
  });
}

export type EndpointFormValues = z.infer<ReturnType<typeof createEndpointSchema>>;

// ── Form schema definition (Zod + UI metadata + sections) ──────────────────────

/**
 * Creates the complete form schema definition for the endpoint add/edit form.
 */
export function createEndpointFormDef(_: I18n["_"], isEdit: boolean) {
  const KIND_OPTIONS = INTEGRATION_KINDS.map((k) => ({
    value: k.value,
    label: k.label,
  }));

  return {
    schema: createEndpointSchema,
    fields: {
      name: {
        label: _(msg`Name`),
        description: _(msg`Human-readable label for this integration`),
        placeholder: _(msg`Odoo Production`),
        section: "main",
      },
      kind: {
        label: _(msg`Type`),
        description: _(msg`Integration protocol`),
        widget: "select" as const,
        options: KIND_OPTIONS,
        section: "main",
        disabled: isEdit,
      },
      url: {
        label: _(msg`URL`),
        description: _(msg`Destination URL for events`),
        placeholder: "https://...",
        section: "main",
      },
      config_json: {
        label: _(msg`Config (JSON)`),
        description: _(msg`Optional JSON configuration object. Merge with URL for webhooks.`),
        section: "main",
      },
    },
    sections: [
      {
        key: "main",
        title: isEdit ? _(msg`Edit Endpoint`) : _(msg`New Endpoint`),
        description: _(msg`Configure where attendance events are delivered.`),
      },
    ],
  } satisfies FormSchemaDefinition;
}

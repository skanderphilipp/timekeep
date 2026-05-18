import { z } from "zod";
import { msg } from "@lingui/core/macro";
import type { I18n } from "@lingui/core";

/** Minimum poll interval in seconds. */
const MIN_POLL_INTERVAL_SECS = 5;
/** Maximum poll interval in seconds. */
const MAX_POLL_INTERVAL_SECS = 300;

import type { FormSchemaDefinition } from "@/lib/form-field-meta";

// ── Zod validation schema ──────────────────────────────────────────────────────

/**
 * Validation schema for system settings.
 *
 * Extracted from `use-system-settings.ts` so it can be shared between
 * the hook (validation) and `<SchemaForm>` (rendering).
 */
export function createSystemSettingsSchema(_: I18n["_"]) {
  return z.object({
    poll_interval_secs: z
      .number()
      .min(
        MIN_POLL_INTERVAL_SECS,
        _(msg`Minimum ${MIN_POLL_INTERVAL_SECS} seconds`),
      )
      .max(
        MAX_POLL_INTERVAL_SECS,
        _(msg`Maximum ${MAX_POLL_INTERVAL_SECS} seconds`),
      ),
    auto_discover: z.boolean(),
  });
}

export type SystemSettingsFormValues = z.infer<
  ReturnType<typeof createSystemSettingsSchema>
>;

// ── Form schema definition ─────────────────────────────────────────────────────

/**
 * Creates the complete form schema definition for system settings.
 */
export function createSystemSettingsFormDef(_: I18n["_"]) {
  return {
    schema: createSystemSettingsSchema,
    fields: {
      poll_interval_secs: {
        label: _(msg`Poll Interval (seconds)`),
        description: _(
          msg`How often the server checks scanners for new records. Lower = fresher data, more network load.`,
        ),
        section: "polling",
      },
      auto_discover: {
        label: _(msg`Auto-discover devices`),
        description: _(
          msg`Periodically scan the local network for new ZKTeco scanners.`,
        ),
        section: "polling",
      },
    },
    sections: [
      {
        key: "polling",
        title: _(msg`Device Polling`),
        description: _(
          msg`Control how the server reads attendance data from connected scanners.`,
        ),
      },
    ],
  } satisfies FormSchemaDefinition;
}

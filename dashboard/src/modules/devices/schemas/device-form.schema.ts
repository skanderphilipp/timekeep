import { z } from "zod";
import { msg } from "@lingui/core/macro";
import type { I18n } from "@lingui/core";

import { MIN_PORT, MAX_PORT, DEFAULT_ZKTECO_PORT } from "@/lib/constants";
import type { FormSchemaDefinition } from "@/lib/form-field-meta";

/** Known device vendor values (mirrors @shared/device-vendors). */
const VENDOR_VALUES = ["zkteco", "suprema", "anviz", "hikvision"] as const;

/**
 * Creates a Zod validation schema for the device add/edit form.
 *
 * Accepts the Lingui i18n instance so validation error messages are
 * internationalized. Call from a component: `createDeviceFormSchema(_)`
 *
 * Note: Uses Zod 4.x API (`message` for required errors, positional
 * message param for `.min()`/`.max()` constraints).
 */
export function createDeviceFormSchema(_: I18n["_"]) {
  return z.object({
    serial_number: z
      .string({ message: _(msg`Serial number is required`) })
      .min(1, _(msg`Serial number is required`)),
    label: z.string().optional().default(""),
    host: z
      .string({ message: _(msg`Host is required`) })
      .min(1, _(msg`Host is required`)),
    port: z
      .number({ message: _(msg`Port is required`) })
      .int()
      .min(MIN_PORT, _(msg`Port must be at least ${MIN_PORT}`))
      .max(MAX_PORT, _(msg`Port must be at most ${MAX_PORT}`))
      .default(DEFAULT_ZKTECO_PORT),
    comm_key: z
      .number({ message: _(msg`Comm key is required`) })
      .int()
      .min(0, _(msg`Comm key must be non-negative`))
      .default(0),
    push_enabled: z.boolean().default(true),
    vendor: z.enum(VENDOR_VALUES).default("zkteco"),
    timezone: z.string().nullable().default(null),
  });
}

export type DeviceFormValues = z.infer<ReturnType<typeof createDeviceFormSchema>>;

// ── Form schema definition (Zod + UI metadata + sections) ────────────────────────

/**
 * Creates the complete form schema definition for the device add/edit form.
 *
 * Bundles Zod validation, per-field UI metadata (labels, placeholders,
 * widget types), and section layout. This is the **single source of truth**
 * for the device form — consumed by both `useDeviceForm` (validation)
 * and `<SchemaForm>` (rendering).
 */
export function createDeviceFormDef(_: I18n["_"]) {
  const def: FormSchemaDefinition = {
    schema: createDeviceFormSchema,
    fields: {
      serial_number: {
        label: _(msg`Serial Number`),
        description: _(msg`Unique scanner identifier (e.g., CQZ7232960836)`),
        section: "identity",
      },
      label: {
        label: _(msg`Label`),
        description: _(msg`Human-readable name for this device`),
        placeholder: _(msg`Office Scanner`),
        section: "identity",
      },
      host: {
        label: _(msg`Host & Port`),
        description: _(msg`IP address or hostname and port (e.g., 192.168.100.74:4370, 127.0.0.1:4371)`),
        placeholder: _(msg`192.168.100.74:4370`),
        widget: "ip-port",
        composite: ["host", "port"],
        section: "connection",
      },
      comm_key: {
        label: _(msg`Comm Key`),
        description: _(msg`Communication key (0 = default, 1995 for some devices)`),
        placeholder: _(msg`0`),
        section: "connection",
      },
      vendor: {
        label: _(msg`Vendor`),
        description: _(msg`Device manufacturer. Defaults to ZKTeco.`),
        placeholder: _(msg`zkteco`),
        section: "connection",
      },
      push_enabled: {
        label: _(msg`Push Enabled`),
        description: _(msg`ADMS push mode (auto-receive punches). Disable for SDK pull mode (poll device directly).`),
        section: "push",
      },
      // timezone: schema-only field, not rendered in the form
    },
    sections: [
      {
        key: "identity",
        title: _(msg`Device Identity`),
        description: _(msg`Unique identifier and human-readable name for this scanner.`),
      },
      {
        key: "connection",
        title: _(msg`Connection`),
        description: _(msg`Network address, protocol settings, and vendor for the scanner.`),
      },
      {
        key: "push",
        title: _(msg`Push Events`),
        description: _(msg`Enable real-time attendance push from this scanner.`),
      },
    ],
  } as const;

  return def;
}

/**
 * Integration kinds — supported external integration types.
 *
 * Mirrors `IntegrationKind` enum in `crates/timekeep-core/src/model/settings.rs`.
 * Serialized as snake_case in API responses. Each kind has a default JSON config schema
 * that determines what config fields the frontend form should render.
 *
 * Framework-agnostic: no React, no Lingui, no runtime imports.
 */

/** Canonical integration kind value strings. */
export type IntegrationKindValue = "webhook" | "odoo" | "sap" | "zapier";

/** Config field descriptor for a single integration kind. */
export type IntegrationConfigField = {
  /** JSON key in the config object. */
  key: string;
  /** Human-readable label for the form field. */
  label: string;
  /** Placeholder text. */
  placeholder: string;
  /** Whether the field is a secret (password input). */
  isSecret?: boolean;
};

/** An integration kind definition. */
export type IntegrationKind = {
  /** Wire value (snake_case). */
  value: IntegrationKindValue;
  /** Human-readable label for dropdowns. */
  label: string;
  /** Config fields to render in the endpoint creation form. */
  configFields: IntegrationConfigField[];
};

/**
 * All supported integration kinds with their config field schemas.
 * Config fields must match `IntegrationEndpoint::default_config()` in Rust.
 */
export const INTEGRATION_KINDS = [
  {
    value: "webhook",
    label: "Webhook",
    configFields: [
      { key: "url",    label: "URL",         placeholder: "https://hooks.example.com/attendance" },
      { key: "secret", label: "Secret",      placeholder: "Optional shared secret for HMAC", isSecret: true },
    ],
  },
  {
    value: "odoo",
    label: "Odoo",
    configFields: [
      { key: "url",      label: "URL",        placeholder: "https://odoo.example.com" },
      { key: "api_key",  label: "API Key",    placeholder: "Odoo API key", isSecret: true },
      { key: "database", label: "Database",   placeholder: "odoo_production" },
    ],
  },
  {
    value: "sap",
    label: "SAP",
    configFields: [],
  },
  {
    value: "zapier",
    label: "Zapier",
    configFields: [
      { key: "url",    label: "Webhook URL",  placeholder: "https://hooks.zapier.com/..." },
      { key: "secret", label: "Secret",       placeholder: "Optional shared secret", isSecret: true },
    ],
  },
] as const satisfies readonly IntegrationKind[];

/** Integration kind value → definition lookup. */
export const INTEGRATION_KIND_MAP = new Map<IntegrationKindValue, IntegrationKind>(
  INTEGRATION_KINDS.map((k) => [k.value, k]),
);

/** Get an integration kind definition by its value string. */
export function getIntegrationKind(value: string): IntegrationKind | undefined {
  return INTEGRATION_KIND_MAP.get(value as IntegrationKindValue);
}
